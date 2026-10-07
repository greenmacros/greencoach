import { useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import ExerciseCard from "../components/ExerciseCard";
import FinishSheet from "../components/FinishSheet";
import PickerSheet from "../components/PickerSheet";
import RestTimerBar from "../components/RestTimerBar";
import { repo } from "../db";
import { formatDayLong } from "../lib/format";
import type { LibraryApi } from "../library/useLibrary";
import { primeAudio, acquireWakeLock } from "../workout/alerts";
import { addSet, buildExerciseLog, moveExercise, previousSets, pruneUnfinished, updateExercise } from "../workout/model";
import type { ExerciseLog, WorkoutLog } from "../workout/types";
import { useRestTimer } from "../workout/useRestTimer";
import { useWorkout } from "../workout/useWorkout";
import { newSlot } from "../program/templates";
import SorenessCard from "../components/SorenessCard";
import { useSoreness } from "../feedback/useSoreness";
import { livePRs, prSetKinds, topPR } from "../workout/pr";
import { prText } from "../workout/prText";
import { vibrate } from "../workout/alerts";

interface Props {
  initial: WorkoutLog;
  lib: LibraryApi;
  /** Finished workouts, newest first: source of "last time" values. */
  history: WorkoutLog[];
  onExit: () => void;
  /** Called after the workout is saved or discarded. */
  onClose: (saved: WorkoutLog | null) => void;
}

export default function Workout({ initial, lib, history, onExit, onClose }: Props) {
  const { t, settings, update } = useApp();
  const { workout, mutate, flush } = useWorkout(initial);
  const timer = useRestTimer({ title: t("timer.done"), body: t("timer.doneBody") });
  const [picker, setPicker] = useState<{ swap: string | null } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const soreness = useSoreness(workout, history, lib.byId);
  const prSets = useMemo(() => prSetKinds(history, workout), [history, workout]);

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4500); return () => clearTimeout(id); }, [toast]);

  // Keep the screen awake while logging, and re-acquire after returning to the tab.
  useEffect(() => {
    if (!settings.keepAwake) return;
    let release: (() => void) | null = null;
    let live = true;
    const grab = async () => { release?.(); const r = await acquireWakeLock(); if (live) release = r; else r?.(); };
    void grab();
    const onVis = () => document.visibilityState === "visible" && void grab();
    document.addEventListener("visibilitychange", onVis);
    return () => { live = false; document.removeEventListener("visibilitychange", onVis); release?.(); };
  }, [settings.keepAwake]);

  // "Last time" per exercise comes from finished history only.
  const prevMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof previousSets>>();
    for (const e of workout.exercises) if (!m.has(e.exerciseId)) m.set(e.exerciseId, previousSets(history, e.exerciseId, workout.id));
    return m;
  }, [history, workout.exercises, workout.id]);

  const toggleSet = (ex: ExerciseLog, setId: string) => {
    const idx = workout.exercises.findIndex(e => e.id === ex.id);
    const nextEx = workout.exercises[idx + 1];
    const wasDone = ex.sets.find(s => s.id === setId)?.done;
    mutate(w => updateExercise(w, ex.id, e => ({
      ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, done: !s.done, doneAt: s.done ? null : new Date().toISOString() } : s)),
    })));
    if (!wasDone) {
      const hits = livePRs(history, { ...workout, exercises: workout.exercises.map(e => e.id !== ex.id ? e : { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, done: true } : s) }) }, ex.id, setId);
      const top = topPR(hits);
      if (top) {
        setToast(t("pr.toast", { name: lib.byId(ex.exerciseId)?.name[settings.lang] ?? "", what: prText(top, workout.unit, t) }));
        if (settings.restVibrate) vibrate(40);
      }
      primeAudio(); // allowed here: inside a tap
      const inSuperset = ex.supersetGroup !== null && nextEx?.supersetGroup === ex.supersetGroup;
      if (!inSuperset) timer.start(ex.restSec);
    }
  };

  const addExercise = (exerciseId: string) => {
    const ex = lib.byId(exerciseId);
    const compound = ex?.mechanic !== "isolation";
    const slot = newSlot(exerciseId, compound);
    const log = buildExerciseLog({ ...slot, id: "" }, exerciseId, previousSets(history, exerciseId));
    mutate(w => ({ ...w, exercises: [...w.exercises, { ...log, slotId: null }] }));
    void lib.markUsed(exerciseId);
  };

  const swapExercise = (logId: string, exerciseId: string) => {
    mutate(w => updateExercise(w, logId, e => ({ ...e, exerciseId })));
    void lib.markUsed(exerciseId);
  };

  const save = async (notes: string) => {
    await flush();
    const finishedAt = new Date().toISOString();
    const done = pruneUnfinished({ ...workout, notes, finishedAt });
    const saved = (await repo.put("workouts", done as never)) as unknown as WorkoutLog;
    timer.skip();
    onClose(saved);
  };

  const discard = async () => {
    await flush();
    await repo.remove("workouts", workout.id);
    timer.skip();
    onClose(null);
  };

  const title = workout.sessionName || t("wk.quick");
  const doneSets = workout.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <section className="grid gap-3" style={{ paddingBottom: "9rem" }}>
      <header className="flex items-center gap-2">
        <button className="btn" onClick={() => { void flush(); onExit(); }}>← {t("wk.back")}</button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="font-bold truncate">{title}</h1>
          <p className="muted text-xs">{formatDayLong(workout.dayKey, settings.lang)} · {doneSets}/{totalSets}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setFinishing(true)}>{t("wk.finish")}</button>
      </header>

      <label className="flex items-center gap-2 text-sm muted">
        <input type="checkbox" checked={settings.keepAwake} onChange={e => void update({ keepAwake: e.target.checked })} />{t("wk.keepAwake")}
      </label>

      <SorenessCard questions={soreness.questions} answers={soreness.answers} onAnswer={(m, l, id) => void soreness.answer(m, l, id)} />

      {workout.exercises.length === 0 && <p className="card muted">{t("wk.empty")}</p>}

      {workout.exercises.map((log, i) => (
        <ExerciseCard key={log.id} log={log} ex={lib.byId(log.exerciseId)} unit={workout.unit} prev={prevMap.get(log.exerciseId) ?? []} prSets={prSets}
          index={i} count={workout.exercises.length}
          onChange={fn => mutate(w => updateExercise(w, log.id, fn))}
          onSetToggle={id => toggleSet(log, id)}
          onAddSet={() => mutate(w => updateExercise(w, log.id, e => addSet(e)))}
          onMove={d => mutate(w => moveExercise(w, log.id, d))}
          onRemove={() => mutate(w => ({ ...w, exercises: w.exercises.filter(e => e.id !== log.id) }))}
          onSwap={() => setPicker({ swap: log.id })} />
      ))}

      <button className="btn" onClick={() => setPicker({ swap: null })}>＋ {t("wk.addExercise")}</button>

      {picker && (
        <PickerSheet lib={lib} title={picker.swap ? t("wk.swapExercise") : t("wk.addExercise")} onClose={() => setPicker(null)}
          onPick={ex => { picker.swap ? swapExercise(picker.swap, ex.id) : addExercise(ex.id); setPicker(null); }} />
      )}

      {finishing && (
        <FinishSheet workout={workout} history={history} onFeel={patch => mutate(w => ({ ...w, ...patch }))} lookup={lib.byId} onKeepGoing={() => setFinishing(false)} onSave={save} onDiscard={discard}
          onNotes={notes => mutate(w => ({ ...w, notes }))} />
      )}

      <RestTimerBar timer={timer} onChoose={sec => {
        // Choosing a time also becomes this exercise's rest for the rest of the workout.
        const lastDone = [...workout.exercises].reverse().find(e => e.sets.some(s => s.done));
        if (lastDone) mutate(w => updateExercise(w, lastDone.id, e => ({ ...e, restSec: sec })));
      }} />
      {toast && (
        <div role="status" className="card fixed left-4 right-4 mx-auto max-w-xl font-semibold" style={{ bottom: "9.5rem", zIndex: 40, borderColor: "var(--accent)" }}>🏆 {toast}</div>
      )}
    </section>
  );
}
