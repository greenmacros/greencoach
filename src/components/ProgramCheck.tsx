import { useMemo, useState } from "react";
import type { Program } from "../program/types";
import { useApp } from "../app-context";
import { CHECK_MUSCLES, MAX_FOCUS, checkProgram, type Finding } from "../coach/programCheck";
import { myEquipment } from "../library/equipment";
import type { Exercise, Muscle } from "../library/types";
import type { LibraryApi } from "../library/useLibrary";
import { newSlot } from "../program/templates";
import type { ProgramApi } from "../program/useProgram";
import type { WorkoutLog } from "../workout/types";
import ExerciseMedia from "./ExerciseMedia";
import Icon from "./Icon";
import PickerSheet from "./PickerSheet";

/**
 * Coach → Program check: the whole weekly plan against your goal and focus muscles. Every finding has a suggested
 * change you can apply, swap for any other exercise, or ignore. Nothing changes on its own.
 */
export default function ProgramCheck({ prog, lib, finished, planWeekStart }: { prog: ProgramApi; lib: LibraryApi; finished: readonly WorkoutLog[]; planWeekStart?: string }) {
  const { t, settings, update, profile, updateProfile } = useApp();
  const lang = settings.lang;
  const program = prog.active;
  const focusList = profile.focusMuscles;
  const focus = useMemo(() => focusList ?? [], [focusList]);
  const [picking, setPicking] = useState<{ muscle?: Muscle; sessionId: string; sets: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const findings = useMemo(() => (program && lib.ready ? checkProgram({
    program, all: lib.all, lookup: lib.byId, focus, have: myEquipment(profile), workouts: finished, today: prog.todayKey,
    dismissed: settings.programCheckDismissed ?? {}, planWeekStart,
    profile: { experience: profile.experience, goal: profile.goal, phase: profile.phase, equipment: profile.equipment, region: settings.region, weightUnit: settings.weightUnit },
  }) : []), [program, lib.ready, lib.all, lib.byId, focus, profile, finished, prog.todayKey, settings.programCheckDismissed, settings.region, settings.weightUnit, planWeekStart]);

  if (!program) return null;
  const sessionName = (id: string) => program.sessions.find(s => s.id === id)?.name ?? "";
  const exName = (id: string) => lib.byId(id)?.name[lang] ?? id;
  const muscle = (m: Muscle) => t(`muscle.${m}`);

  const ignore = (f: Finding) => void update(s => ({ programCheckDismissed: { ...(s.programCheckDismissed ?? {}), [f.id]: prog.todayKey } }));
  // Through the shared program queue (latest stored version, one change at a time). While one runs, actions are
  // disabled so a double tap cannot add the same exercise twice; a failed save says so.
  const run = async (fn: (p: Program) => Program) => {
    setBusy(true); setError(false);
    try { if (!(await prog.change(program.id, fn))) setError(true); } catch { setError(true); } finally { setBusy(false); }
  };
  const addExercise = (sessionId: string, ex: Exercise, sets: number) => {
    const slot = { ...newSlot(ex.id, ex.mechanic !== "isolation"), sets };
    return run(p => ({ ...p, sessions: p.sessions.map(s => (s.id === sessionId ? { ...s, exercises: [...s.exercises, slot] } : s)) }));
  };
  const setSets = (slotId: string, sets: number) =>
    run(p => ({ ...p, sessions: p.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => (e.id === slotId ? { ...e, sets } : e)) })) }));
  const toggleFocus = (m: Muscle) => void updateProfile(p => {
    const cur = p.focusMuscles ?? [];
    return { focusMuscles: cur.includes(m) ? cur.filter(x => x !== m) : cur.length < MAX_FOCUS ? [...cur, m] : cur };
  });

  const candidates = (ids: string[], sessionId: string, sets: number, m?: Muscle) => (
    <div className="grid gap-2">
      {ids.map(id => {
        const ex = lib.byId(id);
        return ex ? (
          <button key={id} className="btn flex items-center gap-3 text-left" style={{ justifyContent: "flex-start", minHeight: 56, padding: "6px 10px" }}
            disabled={busy} onClick={() => void addExercise(sessionId, ex, sets)}>
            <ExerciseMedia ex={ex} size={40} />
            <span className="flex-1">{t("pc.add", { name: ex.name[lang], sets })}</span>
            <Icon name="plus" />
          </button>
        ) : null;
      })}
      <button className="chip justify-self-start" onClick={() => setPicking({ muscle: m, sessionId, sets })}>{t("pc.more")}</button>
    </div>
  );

  const body = (f: Finding) => {
    switch (f.kind) {
      case "under": return (
        <>
          <p>{t(f.focus ? "pc.underFocus" : "pc.under", { m: muscle(f.muscle), n: f.sets, target: f.target, session: sessionName(f.sessionId) })}</p>
          {f.fullSessionId && <p className="muted">{t("pc.spread", { full: sessionName(f.fullSessionId), m: muscle(f.muscle), session: sessionName(f.sessionId) })}</p>}
          {candidates(f.candidates, f.sessionId, f.addSets, f.muscle)}
        </>
      );
      case "pain": return <p>{t("pc.pain", { m: muscle(f.muscle), n: f.sets, target: f.target })}</p>;
      case "over": return (
        <>
          <p>{t("pc.over", { m: muscle(f.muscle), n: f.sets, mrv: f.mrv })}</p>
          <button className="btn btn-primary justify-self-start" disabled={busy} onClick={() => void setSets(f.slotId, f.newSets)}>
            {t("pc.trim", { name: exName(f.exerciseId), session: sessionName(f.sessionId), sets: f.newSets })}
          </button>
        </>
      );
      case "overNote": return <p>{t("pc.overNote", { m: muscle(f.muscle), n: f.sets, mrv: f.mrv })}</p>;
      case "balance": return (
        <>
          <p>{t("pc.balance", { push: f.push, pull: f.pull, session: sessionName(f.sessionId) })}</p>
          {candidates(f.candidates, f.sessionId, f.addSets)}
        </>
      );
      case "crowded": return <p>{t("pc.crowded", { session: sessionName(f.sessionId), n: f.sets, m: muscle(f.muscle), cap: f.cap })}</p>;
      case "long": return <p>{t("pc.long", { session: sessionName(f.sessionId), min: f.minutes })}</p>;
    }
  };

  return (
    <section className="card grid gap-3" aria-labelledby="pc-h">
      <button className="flex items-center gap-2 text-left" style={{ background: "none", border: 0, padding: 0, minHeight: 44, color: "var(--text)", cursor: "pointer" }}
        aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="flex-1">
          <span id="pc-h" className="block font-bold text-lg">{t("pc.title")}</span>
          <span className="block muted text-sm">{findings.length ? t("pc.count", { n: findings.length }) : t("pc.ok")}</span>
        </span>
        <Icon name={open ? "up" : "down"} />
      </button>
      {open && (
        <>
          <p className="muted text-sm">{t("pc.hint")}</p>
          <div className="grid gap-1">
            <p className="text-sm font-semibold">{t("pc.focus", { n: MAX_FOCUS })}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("pc.focus", { n: MAX_FOCUS })}>
              {CHECK_MUSCLES.map(m => (
                <button key={m} className="chip" aria-pressed={focus.includes(m)} disabled={!focus.includes(m) && focus.length >= MAX_FOCUS} onClick={() => toggleFocus(m)}>{muscle(m)}</button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{t("pc.saveFailed")}</p>}
          {findings.map(f => (
            <div key={f.id} className="card grid gap-2 text-sm" style={{ padding: 12, borderColor: f.kind === "pain" || f.kind === "over" || f.kind === "overNote" ? "var(--danger)" : "var(--border)" }}>
              {body(f)}
              <button className="btn justify-self-start" style={{ border: 0, background: "transparent", color: "var(--muted)", padding: 0, minHeight: 36 }} onClick={() => ignore(f)}>{t("pc.ignore")}</button>
            </div>
          ))}
        </>
      )}
      {picking && (
        <PickerSheet lib={lib} title={t("pc.pickTitle")} muscles={picking.muscle ? [picking.muscle] : undefined} onClose={() => setPicking(null)}
          onPick={ex => {
            const target = program.sessions.find(s => s.id === picking.sessionId);
            // Busy (another change saving) or already in that session: do not add a duplicate.
            if (!busy && !target?.exercises.some(e => e.exerciseId === ex.id)) void addExercise(picking.sessionId, ex, picking.sets);
            setPicking(null);
          }} />
      )}
    </section>
  );
}
