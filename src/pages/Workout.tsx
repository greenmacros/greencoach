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
import { addSet, buildExerciseLog, moveExercise, previousSets, pruneUnfinished, updateExercise, hasAnyDoneSet } from "../workout/model";
import type { ExerciseLog, WorkoutLog } from "../workout/types";
import { useRestTimer } from "../workout/useRestTimer";
import { useWorkout } from "../workout/useWorkout";
import { newSlot } from "../program/templates";
import FeedbackSheet from "../components/FeedbackSheet";
import { useSoreness } from "../feedback/useSoreness";
import { livePRs, prSetKinds, topPR } from "../workout/pr";
import { prText } from "../workout/prText";
import { vibrate } from "../workout/alerts";
import type { AutoChange } from "../coach/auto";
import Icon from "../components/Icon";
import { dayKey } from "../lib/id";

interface Props {
  initial: WorkoutLog;
  lib: LibraryApi;
  /** Finished workouts, newest first: source of "last time" values. */
  history: WorkoutLog[];
  onExit: () => void;
  /** Called after the workout is saved or discarded. */
  onClose: (saved: WorkoutLog | null) => void;
  /** This week's automatic coach changes, by program slot id. */
  coachChanges?: Map<string, AutoChange>;
  /** Editing a finished session: its saved version, restored if the edit is cancelled. */
  original?: WorkoutLog;
}

export default function Workout({ initial, lib, history, onExit, onClose, coachChanges, original }: Props) {
  const editMode = !!original;
  const { t, settings, update } = useApp();
  const localToday = dayKey(new Date(), settings.dayStartHour);
  const { workout, mutate, flush } = useWorkout(initial, { autosave: !original });
  const [editError, setEditError] = useState(false);
  const timer = useRestTimer({ title: t("timer.done"), body: t("timer.doneBody") });
  const [picker, setPicker] = useState<{ swap: string | null } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [editSleep, setEditSleep] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const soreness = useSoreness(workout, history, lib.byId);
  const [fbFor, setFbFor] = useState<string | null>(null);
  const [asked] = useState(() => new Set<string>());
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
    // A set ticked while editing a past session belongs to that session's time, not to now.
    const doneAt = editMode ? workout.finishedAt ?? workout.startedAt : new Date().toISOString();
    mutate(w => updateExercise(w, ex.id, e => ({
      ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, done: !s.done, doneAt: s.done ? null : doneAt } : s)),
    })));
    const finishesExercise = ex.sets.every(s => s.id === setId || s.done || s.skipped);
    // Finishing the last set of an exercise opens the feedback sheet once.
    if (!wasDone && !editMode && !asked.has(ex.id) && finishesExercise) {
      asked.add(ex.id);
      setFbFor(ex.id);
    }
    if (!wasDone) {
      const hits = livePRs(history, { ...workout, exercises: workout.exercises.map(e => e.id !== ex.id ? e : { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, done: true } : s) }) }, ex.id, setId);
      const top = topPR(hits);
      if (top) {
        setToast(t("pr.toast", { name: lib.byId(ex.exerciseId)?.name[settings.lang] ?? "", what: prText(top, workout.unit, t) }));
        if (settings.restVibrate) vibrate(40);
      }
      primeAudio(); // allowed here: inside a tap
      const inSuperset = ex.supersetGroup !== null && nextEx?.supersetGroup === ex.supersetGroup;
      // No rest timer after an exercise's last set: the user is moving on to the next exercise.
      if (!inSuperset && !finishesExercise && !editMode) timer.start(ex.restSec);
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

  /** Edit mode: keep the original finish time, drop sets that are not logged, close. */
  const saveEdit = async () => {
    if (!hasAnyDoneSet(workout)) return setEditError(true); // an empty session is deleted in History, not saved
    const saved = (await repo.put("workouts", pruneUnfinished({ ...workout, finishedAt: workout.finishedAt ?? original!.finishedAt }) as never)) as unknown as WorkoutLog;
    onClose(saved);
  };
  const cancelEdit = () => onClose(original!); // nothing was stored while editing

  /** Moving a session to another day moves its timestamps too, so history stays in order. */
  const moveTo = (d: string) => mutate(w => {
    const ms = (Date.parse(d + "T12:00:00") - Date.parse(w.dayKey + "T12:00:00"));
    const shift = (iso: string | null) => (iso ? new Date(Date.parse(iso) + ms).toISOString() : iso);
    return {
      ...w, dayKey: d, startedAt: shift(w.startedAt)!, finishedAt: shift(w.finishedAt),
      exercises: w.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, doneAt: shift(s.doneAt) })) })),
    };
  });

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
    <section className="grid gap-3" style={{ paddingBottom: "calc(14rem + env(safe-area-inset-bottom))" }}>
      <header className="flex items-center gap-2">
        {editMode
          ? <button className="btn" onClick={cancelEdit}>{t("hist.cancelEdit")}</button>
          : <button className="btn" onClick={() => { void flush(); onExit(); }}><Icon name="back" /> {t("wk.back")}</button>}
        <div className="flex-1 min-w-0 text-center">
          {workout.mesoWeek && workout.mesoDay && <p className="text-xs font-bold uppercase muted" style={{ letterSpacing: 0.5 }}>{t("wk.dayLabel", { w: workout.mesoWeek, d: workout.mesoDay })}</p>}
          <h1 className="font-bold truncate">{title}</h1>
          <p className="muted text-xs">{formatDayLong(workout.dayKey, settings.lang)} · {doneSets}/{totalSets}</p>
        </div>
        {editMode
          ? <button className="btn btn-primary" onClick={() => void saveEdit()}>{t("hist.saveEdit")}</button>
          : <button className="btn btn-primary" onClick={() => setFinishing(true)}>{t("wk.finish")}</button>}
      </header>

      {editMode && (
        <div className="card grid gap-2" style={{ padding: 12, borderColor: "var(--accent)" }} role="status">
          <p className="text-sm font-semibold">{t("hist.editing")}</p>
          <label className="flex items-center gap-2 text-sm"><span className="muted">{t("hist.date")}</span>
            <input type="date" className="field" style={{ maxWidth: 200 }} value={workout.dayKey} max={localToday}
              onChange={e => { const d = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= localToday) moveTo(d); }} />
          </label>
          {editError && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{t("hist.editEmpty")}</p>}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm muted">
        <input type="checkbox" checked={settings.keepAwake} onChange={e => void update({ keepAwake: e.target.checked })} />{t("wk.keepAwake")}
      </label>

      {/* Optional sleep check-in: one tap, feeds the coach's recovery decisions. */}
      {(workout.sleep === undefined || editSleep) ? (
        <div className="card grid gap-2" style={{ padding: 12 }} role="group" aria-label={t("sleep.q")}>
          <p className="font-semibold text-sm">{t("sleep.q")}</p>
          <div className="seg">
            {([1, 2, 3] as const).map(v => (
              <button key={v} aria-pressed={workout.sleep === v} onClick={() => { mutate(w => ({ ...w, sleep: v })); setEditSleep(false); }}>{t(`sleep.${v}`)}</button>
            ))}
          </div>
        </div>
      ) : (
        <button className="text-sm muted text-left" style={{ background: "none", border: 0, padding: 0, minHeight: 32, cursor: "pointer", color: "var(--muted)" }} onClick={() => setEditSleep(true)}>
          {t("sleep.answered", { v: t(`sleep.${workout.sleep}`) })}
        </button>
      )}

      {workout.exercises.length === 0 && <p className="card muted">{t("wk.empty")}</p>}

      {workout.exercises.map((log, i) => (
        <ExerciseCard key={log.id} log={log} ex={lib.byId(log.exerciseId)} coach={log.slotId ? coachChanges?.get(log.slotId) : undefined} unit={workout.unit} prev={prevMap.get(log.exerciseId) ?? []} prSets={prSets}
          index={i} count={workout.exercises.length}
          onChange={fn => mutate(w => updateExercise(w, log.id, fn))}
          onSetToggle={id => toggleSet(log, id)}
          onAddSet={() => mutate(w => updateExercise(w, log.id, e => addSet(e)))}
          onMove={d => mutate(w => moveExercise(w, log.id, d))}
          onRemove={() => mutate(w => ({ ...w, exercises: w.exercises.filter(e => e.id !== log.id) }))}
          onSwap={() => setPicker({ swap: log.id })} onFeedback={() => setFbFor(log.id)} />
      ))}

      <button className="btn" onClick={() => setPicker({ swap: null })}><Icon name="plus" /> {t("wk.addExercise")}</button>

      {picker && (
        <PickerSheet lib={lib} title={picker.swap ? t("wk.swapExercise") : t("wk.addExercise")} onClose={() => setPicker(null)}
          onPick={ex => { picker.swap ? swapExercise(picker.swap, ex.id) : addExercise(ex.id); setPicker(null); }} />
      )}

      {fbFor && (() => {
        const log = workout.exercises.find(e => e.id === fbFor);
        const ex = log && lib.byId(log.exerciseId);
        if (!log || !ex) return null;
        const muscle = ex.primary[0];
        const q = soreness.questions.find(x => x.muscle === muscle && !soreness.answers.has(muscle));
        return (
          <FeedbackSheet log={log} name={ex.name[settings.lang]} muscle={muscle} soreness={q} onCancel={() => setFbFor(null)}
            onSave={(patch, level) => {
              mutate(w => updateExercise(w, log.id, e => ({ ...e, ...patch })));
              if (q && level !== undefined) void soreness.answer(muscle, level, q.prevWorkoutId);
              setFbFor(null);
            }} />
        );
      })()}

      {finishing && (
        <FinishSheet workout={workout} history={history} onFeel={patch => mutate(w => ({ ...w, ...patch }))} lookup={lib.byId} onKeepGoing={() => setFinishing(false)} onSave={save} onDiscard={discard}
          onNotes={notes => mutate(w => ({ ...w, notes }))} />
      )}

      {!editMode && <RestTimerBar timer={timer} onChoose={sec => {
        // Choosing a time also becomes this exercise's rest for the rest of the workout.
        const lastDone = [...workout.exercises].reverse().find(e => e.sets.some(s => s.done));
        if (lastDone) mutate(w => updateExercise(w, lastDone.id, e => ({ ...e, restSec: sec })));
      }} />}
      {toast && (
        <div role="status" className="card fixed left-4 right-4 mx-auto max-w-xl font-semibold" style={{ bottom: "calc(13rem + env(safe-area-inset-bottom))", zIndex: 25, borderColor: "var(--accent)" }}><Icon name="trophy" style={{ color: "var(--accent)" }} /> {toast}</div>
      )}
    </section>
  );
}
