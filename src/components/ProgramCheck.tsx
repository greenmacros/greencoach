import { useMemo, useRef, useState } from "react";
import { repo } from "../db";
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
export default function ProgramCheck({ prog, lib, finished }: { prog: ProgramApi; lib: LibraryApi; finished: readonly WorkoutLog[] }) {
  const { t, settings, update, profile, updateProfile } = useApp();
  const lang = settings.lang;
  const program = prog.active;
  const focusList = profile.focusMuscles;
  const focus = useMemo(() => focusList ?? [], [focusList]);
  const [picking, setPicking] = useState<{ muscle?: Muscle; sessionId: string; sets: number } | null>(null);
  const [open, setOpen] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const findings = useMemo(() => (program && lib.ready ? checkProgram({
    program, all: lib.all, lookup: lib.byId, focus, have: myEquipment(profile), workouts: finished, today: prog.todayKey,
    dismissed: settings.programCheckDismissed ?? {},
    profile: { experience: profile.experience, goal: profile.goal, phase: profile.phase, equipment: profile.equipment, region: settings.region, weightUnit: settings.weightUnit },
  }) : []), [program, lib.ready, lib.all, lib.byId, focus, profile, finished, prog.todayKey, settings.programCheckDismissed, settings.region, settings.weightUnit]);

  if (!program) return null;
  const sessionName = (id: string) => program.sessions.find(s => s.id === id)?.name ?? "";
  const exName = (id: string) => lib.byId(id)?.name[lang] ?? id;
  const muscle = (m: Muscle) => t(`muscle.${m}`);

  const ignore = (f: Finding) => void update({ programCheckDismissed: { ...(settings.programCheckDismissed ?? {}), [f.id]: prog.todayKey } });
  // Changes apply one at a time onto the stored program, so quick taps never overwrite each other.
  const change = (fn: (p: Program) => Program) => {
    queue.current = queue.current.then(async () => {
      const latest = ((await repo.get("programs", program.id)) as unknown as Program | undefined) ?? program;
      await prog.save(fn(latest));
    }).catch(() => {});
    return queue.current;
  };
  const addExercise = (sessionId: string, ex: Exercise, sets: number) => {
    const slot = { ...newSlot(ex.id, ex.mechanic !== "isolation"), sets };
    return change(p => ({ ...p, sessions: p.sessions.map(s => (s.id === sessionId ? { ...s, exercises: [...s.exercises, slot] } : s)) }));
  };
  const setSets = (slotId: string, sets: number) =>
    change(p => ({ ...p, sessions: p.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => (e.id === slotId ? { ...e, sets } : e)) })) }));
  const toggleFocus = (m: Muscle) => {
    const next = focus.includes(m) ? focus.filter(x => x !== m) : focus.length < MAX_FOCUS ? [...focus, m] : focus;
    void updateProfile({ focusMuscles: next });
  };

  const candidates = (ids: string[], sessionId: string, sets: number, m?: Muscle) => (
    <div className="grid gap-2">
      {ids.map(id => {
        const ex = lib.byId(id);
        return ex ? (
          <button key={id} className="btn flex items-center gap-3 text-left" style={{ justifyContent: "flex-start", minHeight: 56, padding: "6px 10px" }}
            onClick={() => void addExercise(sessionId, ex, sets)}>
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
          {candidates(f.candidates, f.sessionId, f.addSets, f.muscle)}
        </>
      );
      case "pain": return <p>{t("pc.pain", { m: muscle(f.muscle), n: f.sets, target: f.target })}</p>;
      case "over": return (
        <>
          <p>{t("pc.over", { m: muscle(f.muscle), n: f.sets, mrv: f.mrv })}</p>
          <button className="btn btn-primary justify-self-start" onClick={() => void setSets(f.slotId, f.newSets)}>
            {t("pc.trim", { name: exName(f.exerciseId), session: sessionName(f.sessionId), sets: f.newSets })}
          </button>
        </>
      );
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
          {findings.map(f => (
            <div key={f.id} className="card grid gap-2 text-sm" style={{ padding: 12, borderColor: f.kind === "pain" || f.kind === "over" ? "var(--danger)" : "var(--border)" }}>
              {body(f)}
              <button className="btn justify-self-start" style={{ border: 0, background: "transparent", color: "var(--muted)", padding: 0, minHeight: 36 }} onClick={() => ignore(f)}>{t("pc.ignore")}</button>
            </div>
          ))}
        </>
      )}
      {picking && (
        <PickerSheet lib={lib} title={t("pc.pickTitle")} muscles={picking.muscle ? [picking.muscle] : undefined} onClose={() => setPicking(null)}
          onPick={ex => { void addExercise(picking.sessionId, ex, picking.sets); setPicking(null); }} />
      )}
    </section>
  );
}
