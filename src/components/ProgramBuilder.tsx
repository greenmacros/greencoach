import { useState } from "react";
import { useApp } from "../app-context";
import { formatDayKey, weekdayLong } from "../lib/format";
import { newId } from "../lib/id";
import type { LibraryApi } from "../library/useLibrary";
import { estimateMinutes, totalSets, weekDays, weekStart } from "../program/schedule";
import { newSlot } from "../program/templates";
import { MESO_MAX, MESO_MIN, type ExerciseSlot, type Program, type SessionTemplate } from "../program/types";
import type { ProgramApi } from "../program/useProgram";
import PickerSheet from "./PickerSheet";
import SlotEditor from "./SlotEditor";
import Stepper from "./Stepper";
import TextInput from "./TextInput";
import SharePlanSheet from "./SharePlanSheet";
import PasteLinkSheet from "./PasteLinkSheet";

interface Props { prog: ProgramApi; lib: LibraryApi; program: Program; onNew: () => void }

type Picker = { sessionId: string; replaceSlotId: string | null } | null;

export default function ProgramBuilder({ prog, lib, program, onNew }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [openId, setOpenId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [undo, setUndo] = useState<{ text: string; run: () => Promise<void> } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pasting, setPasting] = useState(false);

  const patch = (p: Partial<Program>) => prog.save({ ...program, ...p });
  const patchSession = (id: string, fn: (s: SessionTemplate) => SessionTemplate) =>
    patch({ sessions: program.sessions.map(s => (s.id === id ? fn(s) : s)) });

  const addSession = async () => {
    const s = prog.newSession(t("prog.newSession"));
    await patch({ sessions: [...program.sessions, s] });
    setOpenId(s.id);
  };

  const duplicate = async (s: SessionTemplate) => {
    const copy: SessionTemplate = { ...s, id: newId(), name: `${s.name} (2)`, exercises: s.exercises.map(e => ({ ...e, id: newId() })) };
    await patch({ sessions: [...program.sessions, copy] });
  };

  const deleteSession = async (s: SessionTemplate) => {
    const before = program;
    await patch({ sessions: program.sessions.filter(x => x.id !== s.id), week: program.week.map(w => (w === s.id ? null : w)) });
    setOpenId(null);
    setUndo({ text: t("prog.sessionDeleted"), run: async () => { await prog.restore(before); } });
  };

  const pick = async (exId: string, isCompound: boolean) => {
    if (!picker) return;
    const { sessionId, replaceSlotId } = picker;
    await patchSession(sessionId, s => ({
      ...s,
      exercises: replaceSlotId
        ? s.exercises.map(e => (e.id === replaceSlotId ? { ...e, exerciseId: exId } : e))
        : [...s.exercises, newSlot(exId, isCompound)],
    }));
    setPicker(null);
  };

  const move = (s: SessionTemplate, i: number, dir: -1 | 1) => {
    const arr = [...s.exercises];
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    return patchSession(s.id, x => ({ ...x, exercises: arr }));
  };

  const updateSlot = (s: SessionTemplate, slot: ExerciseSlot) =>
    patchSession(s.id, x => ({ ...x, exercises: x.exercises.map(e => (e.id === slot.id ? slot : e)) }));

  const week = weekDays(prog.todayKey);

  return (
    <div className="grid gap-4">
      <div className="card grid gap-3">
        {prog.programs.length > 1 && (
          <label className="grid gap-1"><span className="muted text-sm">{t("prog.switch")}</span>
            <select className="field" value={program.id} onChange={e => void prog.setActive(e.target.value)}>
              {prog.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label className="grid gap-1"><span className="muted text-sm">{t("prog.name")}</span>
          <TextInput className="field" value={program.name} onValue={v => void patch({ name: v })} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={onNew}>＋ {t("prog.new")}</button>
          <button className="btn" onClick={() => setSharing(true)}>{t("share.button")}</button>
          <button className="btn" onClick={() => setPasting(true)}>{t("share.importPaste")}</button>
          <button className="btn btn-danger" onClick={async () => {
            const cur = await prog.remove(program.id);
            if (cur) setUndo({ text: t("prog.deleted"), run: async () => { await prog.restore(cur); } });
          }}>{t("prog.delete")}</button>
        </div>
      </div>

      <div className="card grid gap-2">
        <h2 className="font-bold">{t("prog.week")}</h2>
        {week.map((k, i) => (
          <label key={k} className="flex items-center gap-3">
            <span className="w-24 shrink-0">{weekdayLong(k, lang)}</span>
            <select className="field" aria-label={weekdayLong(k, lang)} value={program.week[i] ?? ""}
              onChange={e => void patch({ week: program.week.map((w, j) => (j === i ? e.target.value || null : w)) })}>
              <option value="">{t("prog.rest")}</option>
              {program.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="card grid gap-2">
        <h2 className="font-bold">{t("prog.meso")}</h2>
        <p className="muted text-sm">{t("prog.mesoBody", { n: program.accumulationWeeks })}</p>
        <label className="grid gap-1 text-sm"><span className="muted">{t("prog.mesoWeeks")} ({MESO_MIN}-{MESO_MAX})</span>
          <Stepper label={t("prog.mesoWeeks")} value={program.accumulationWeeks} min={MESO_MIN} max={MESO_MAX} onChange={v => void patch({ accumulationWeeks: v })} />
        </label>
        <button className="btn" onClick={() => void patch({ mesoStartDayKey: weekStart(prog.todayKey) })}>{t("prog.restartMeso")}</button>
        <p className="muted text-xs">{formatDayKey(program.mesoStartDayKey, lang, { month: "short", day: "numeric" })}</p>
      </div>

      <div className="grid gap-3">
        <h2 className="font-bold text-lg">{t("prog.sessions")}</h2>
        {program.sessions.map(s => {
          const open = openId === s.id;
          return (
            <article key={s.id} className="card grid gap-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{s.name}</h3>
                  <p className="muted text-sm">{t("today.exercises", { n: s.exercises.length, sets: totalSets(s), min: estimateMinutes(s) })}</p>
                </div>
                <button className="btn" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>{open ? t("prog.collapse") : t("prog.edit")}</button>
              </div>
              {open && (
                <>
                  <TextInput className="field" aria-label={t("prog.sessionName")} value={s.name} onValue={v => void patchSession(s.id, x => ({ ...x, name: v }))} />
                  {s.exercises.length === 0 && <p className="muted">{t("prog.emptySession")}</p>}
                  <ol className="grid gap-3">
                    {s.exercises.map((slot, i) => (
                      <SlotEditor key={slot.id} slot={slot} ex={lib.byId(slot.exerciseId)} index={i} count={s.exercises.length} hasNext={i < s.exercises.length - 1}
                        onChange={x => void updateSlot(s, x)} onMove={d => void move(s, i, d)}
                        onRemove={() => void patchSession(s.id, x => ({ ...x, exercises: x.exercises.filter(e => e.id !== slot.id) }))}
                        onReplace={() => setPicker({ sessionId: s.id, replaceSlotId: slot.id })} />
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={() => setPicker({ sessionId: s.id, replaceSlotId: null })}>＋ {t("prog.addExercise")}</button>
                    <button className="btn" onClick={() => void duplicate(s)}>{t("prog.duplicate")}</button>
                    <button className="btn btn-danger" onClick={() => void deleteSession(s)}>{t("prog.deleteSession")}</button>
                  </div>
                </>
              )}
            </article>
          );
        })}
        <button className="btn" onClick={() => void addSession()}>＋ {t("prog.addSession")}</button>
      </div>

      {pasting && <PasteLinkSheet onClose={() => setPasting(false)} />}
      {sharing && <SharePlanSheet program={program} lib={lib} onClose={() => setSharing(false)} />}
      {picker && <PickerSheet lib={lib} title={t("prog.pickFor")} onClose={() => setPicker(null)} onPick={ex => void pick(ex.id, ex.mechanic !== "isolation")} />}

      {undo && (
        <div role="status" className="card flex items-center gap-3 fixed left-4 right-4 mx-auto max-w-xl" style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))", zIndex: 40 }}>
          <span className="flex-1">{undo.text}</span>
          <button className="btn" onClick={async () => { await undo.run(); setUndo(null); }}>{t("prog.undo")}</button>
          <button className="btn" aria-label={t("lib.close")} onClick={() => setUndo(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
