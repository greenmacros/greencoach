import { newId } from "../lib/id";
import type { Exercise, Muscle } from "../library/types";
import type { ExerciseSlot, SessionTemplate } from "../program/types";
import type { ExerciseLog, ExerciseTarget, SetLog, SetType, WorkoutLog } from "./types";

export const emptySet = (type: SetType = "normal"): SetLog => ({ id: newId(), type, weightKg: null, reps: null, rir: null, done: false, doneAt: null });

/** Sets that count toward hard-set volume and PRs: finished and not warm-ups. */
export const isWorkingSet = (s: SetLog) => s.done && s.type !== "warmup" && s.reps !== null && s.reps > 0;

/** Estimated 1RM (Epley), counting reps in reserve as extra reps. */
export function estimate1RM(weightKg: number, reps: number, rir = 0): number {
  const r = reps + Math.max(0, rir);
  return r <= 1 ? weightKg : weightKg * (1 + r / 30);
}

/** Last finished session containing this exercise (with at least one working set), newest first. */
export function previousSets(history: readonly WorkoutLog[], exerciseId: string, excludeWorkoutId?: string): SetLog[] {
  const done = history
    .filter(w => w.finishedAt && w.id !== excludeWorkoutId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const w of done) {
    const sets = w.exercises.filter(e => e.exerciseId === exerciseId).flatMap(e => e.sets).filter(isWorkingSet);
    if (sets.length) return sets;
  }
  return [];
}

/** The slot's sets, pre-filled from the previous session so a repeat set is a single tap. */
export function buildExerciseLog(slot: ExerciseSlot | null, exerciseId: string, prev: readonly SetLog[], fallbackRest = 120): ExerciseLog {
  const target: ExerciseTarget | null = slot ? { sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax, rir: slot.rir } : null;
  const n = slot?.sets ?? 3;
  const sets = Array.from({ length: n }, (_, i): SetLog => {
    const p = prev[i] ?? prev[prev.length - 1];
    return { ...emptySet(), weightKg: p?.weightKg ?? null, reps: p?.reps ?? null };
  });
  return { id: newId(), exerciseId, slotId: slot?.id ?? null, restSec: slot?.restSec ?? fallbackRest, notes: slot?.notes ?? "", supersetGroup: slot?.supersetGroup ?? null, target, sets };
}

export function createWorkout(opts: {
  dayKey: string; programId: string | null; session: SessionTemplate | null; unit: WorkoutLog["unit"]; history: readonly WorkoutLog[]; mesoWeek?: number; now?: Date;
}): Omit<WorkoutLog, "id" | "createdAt" | "updatedAt" | "schemaVersion"> {
  const { session, history } = opts;
  return {
    dayKey: opts.dayKey,
    programId: opts.programId,
    sessionId: session?.id ?? null,
    sessionName: session?.name ?? "",
    startedAt: (opts.now ?? new Date()).toISOString(),
    finishedAt: null,
    unit: opts.unit,
    exercises: (session?.exercises ?? []).map(slot => buildExerciseLog(slot, slot.exerciseId, previousSets(history, slot.exerciseId))),
    notes: "",
    mesoWeek: opts.mesoWeek,
  };
}

export const updateExercise = (w: WorkoutLog, exId: string, fn: (e: ExerciseLog) => ExerciseLog): WorkoutLog =>
  ({ ...w, exercises: w.exercises.map(e => (e.id === exId ? fn(e) : e)) });

export const updateSet = (w: WorkoutLog, exId: string, setId: string, fn: (s: SetLog) => SetLog): WorkoutLog =>
  updateExercise(w, exId, e => ({ ...e, sets: e.sets.map(s => (s.id === setId ? fn(s) : s)) }));

/** New set copies the weight/reps of the last set so progressing a lift is one tap. */
export function addSet(e: ExerciseLog, type: SetType = "normal"): ExerciseLog {
  const last = e.sets[e.sets.length - 1];
  return { ...e, sets: [...e.sets, { ...emptySet(type), weightKg: last?.weightKg ?? null, reps: last?.reps ?? null }] };
}

export const removeSet = (e: ExerciseLog, setId: string): ExerciseLog => ({ ...e, sets: e.sets.filter(s => s.id !== setId) });

/** Copy weight, reps and RIR from the set above (or from the previous session if it is the first set). */
export function copyLastSet(e: ExerciseLog, setId: string, prev: readonly SetLog[]): ExerciseLog {
  const i = e.sets.findIndex(s => s.id === setId);
  const src = i > 0 ? e.sets[i - 1] : prev[0];
  if (!src) return e;
  return { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, weightKg: src.weightKg, reps: src.reps, rir: src.rir } : s)) };
}

export function moveExercise(w: WorkoutLog, exId: string, dir: -1 | 1): WorkoutLog {
  const i = w.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= w.exercises.length) return w;
  const arr = [...w.exercises];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return { ...w, exercises: arr };
}

export interface Summary {
  durationSec: number;
  volumeKg: number;
  workingSets: number;
  /** Weighted hard sets per muscle: primary = 1, secondary = 0.5. */
  muscleSets: Partial<Record<Muscle, number>>;
}

export function summarize(w: WorkoutLog, lookup: (id: string) => Exercise | undefined, end = new Date()): Summary {
  let volumeKg = 0, workingSets = 0;
  const muscleSets: Partial<Record<Muscle, number>> = {};
  for (const e of w.exercises) {
    const ex = lookup(e.exerciseId);
    for (const s of e.sets) {
      if (!isWorkingSet(s)) continue;
      workingSets++;
      volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
      if (ex) {
        for (const m of ex.primary) muscleSets[m] = (muscleSets[m] ?? 0) + 1;
        for (const m of ex.secondary) muscleSets[m] = (muscleSets[m] ?? 0) + 0.5;
      }
    }
  }
  const stop = w.finishedAt ? new Date(w.finishedAt) : end;
  return { durationSec: Math.max(0, Math.round((stop.getTime() - new Date(w.startedAt).getTime()) / 1000)), volumeKg, workingSets, muscleSets };
}

/** Drop sets nobody finished and exercises left with none, so history stays clean. */
export function pruneUnfinished(w: WorkoutLog): WorkoutLog {
  const exercises = w.exercises
    .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
    .filter(e => e.sets.length > 0);
  return { ...w, exercises };
}

export const hasAnyDoneSet = (w: WorkoutLog) => w.exercises.some(e => e.sets.some(s => s.done));

/** Next unfinished set index across the workout, for "what's next" hints. */
export function nextSet(w: WorkoutLog): { exerciseId: string; setId: string } | null {
  for (const e of w.exercises) for (const s of e.sets) if (!s.done) return { exerciseId: e.id, setId: s.id };
  return null;
}
