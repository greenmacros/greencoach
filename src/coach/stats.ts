import type { SorenessRecord } from "../feedback/soreness";
import type { Exercise, Muscle } from "../library/types";
import { addDays, daysBetween, weekStart } from "../program/schedule";
import type { Program } from "../program/types";
import { estimate1RM, isWorkingSet } from "../workout/model";
import type { ExerciseLog, SetLog, WorkoutLog } from "../workout/types";
import type { CoachConfig } from "./config";
import type { BodyWeightPoint } from "./types";

type Lookup = (id: string) => Exercise | undefined;

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const finished = (ws: readonly WorkoutLog[]) => ws.filter(w => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

/** Weighted hard sets per muscle for a list of (exercise, set count): primary 1, secondary `secondaryWeight`. */
export function weightedSets(items: readonly { exercise: Exercise | undefined; sets: number }[], secondaryWeight: number): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const { exercise, sets } of items) {
    if (!exercise) continue;
    for (const m of exercise.primary) out.set(m, (out.get(m) ?? 0) + sets);
    for (const m of exercise.secondary) out.set(m, (out.get(m) ?? 0) + sets * secondaryWeight);
  }
  return out;
}

/** Planned weekly weighted sets per muscle straight from the program's scheduled sessions. */
export function plannedMuscleSets(program: Program, lookup: Lookup, cfg: CoachConfig): Map<Muscle, number> {
  const items: { exercise: Exercise | undefined; sets: number }[] = [];
  for (const sid of program.week) {
    const s = program.sessions.find(x => x.id === sid);
    if (s) for (const slot of s.exercises) items.push({ exercise: lookup(slot.exerciseId), sets: slot.sets });
  }
  return weightedSets(items, cfg.secondaryWeight);
}

/** Actual weighted hard sets per muscle done in the week starting at `weekStartKey`. */
export function actualMuscleSets(workouts: readonly WorkoutLog[], weekStartKey: string, lookup: Lookup, cfg: CoachConfig): Map<Muscle, number> {
  const end = addDays(weekStartKey, 7);
  const items: { exercise: Exercise | undefined; sets: number }[] = [];
  for (const w of workouts) {
    if (!w.finishedAt || w.dayKey < weekStartKey || w.dayKey >= end) continue;
    for (const e of w.exercises) items.push({ exercise: lookup(e.exerciseId), sets: e.sets.filter(isWorkingSet).length });
  }
  return weightedSets(items, cfg.secondaryWeight);
}

/** Highest weekly weighted volume per muscle over the last `weeks` weeks before `beforeKey`, ignoring deload weeks. */
export function recentPeakSets(workouts: readonly WorkoutLog[], beforeKey: string, weeks: number, deloadWeek: number, lookup: Lookup, cfg: CoachConfig): Map<Muscle, number> {
  const peak = new Map<Muscle, number>();
  for (let i = 1; i <= weeks; i++) {
    const ws = addDays(weekStart(beforeKey), -7 * i);
    const inWeek = workouts.filter(w => w.finishedAt && w.dayKey >= ws && w.dayKey < addDays(ws, 7));
    if (inWeek.length === 0 || inWeek.every(w => w.mesoWeek === deloadWeek)) continue;
    for (const [m, v] of actualMuscleSets(workouts, ws, lookup, cfg)) peak.set(m, Math.max(peak.get(m) ?? 0, v));
  }
  return peak;
}

export interface SessionPerf {
  workoutId: string;
  dayKey: string;
  /** Best estimated 1RM in the session (RIR counts as extra reps; unknown RIR counts as 0). */
  e1rm: number;
  /** Weight used most often in working sets (heaviest on a tie), null for bodyweight. */
  weightKg: number | null;
  sets: SetLog[];
  avgReps: number;
  /** Average reported RIR over sets that have one; null when none do. */
  avgRir: number | null;
  allAtTop: boolean;
  log: ExerciseLog;
}

/** One exercise's history, oldest first. */
export function exerciseSessions(workouts: readonly WorkoutLog[], exerciseId: string): SessionPerf[] {
  const out: SessionPerf[] = [];
  for (const w of finished(workouts)) {
    const logs = w.exercises.filter(e => e.exerciseId === exerciseId);
    const sets = logs.flatMap(e => e.sets.filter(isWorkingSet));
    if (!sets.length) continue;
    const log = logs[0];
    const weights = sets.map(s => s.weightKg ?? 0);
    const counts = new Map<number, number>();
    for (const x of weights) counts.set(x, (counts.get(x) ?? 0) + 1);
    const [modeW] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const rirs = sets.map(s => s.rir).filter((r): r is number => r !== null);
    const e1rm = Math.max(...sets.map(s => ((s.weightKg ?? 0) > 0 ? estimate1RM(s.weightKg!, s.reps!, s.rir ?? 0) : s.reps! * 1)));
    const top = log.target?.repMax ?? Infinity;
    out.push({
      workoutId: w.id, dayKey: w.dayKey, e1rm, weightKg: modeW > 0 ? modeW : null, sets,
      avgReps: mean(sets.map(s => s.reps!)), avgRir: rirs.length ? mean(rirs) : null,
      allAtTop: sets.every(s => s.reps! >= top), log,
    });
  }
  return out;
}

/** Fractional change in e1RM between the last two sessions; null with fewer than two. */
export function lastChange(sessions: readonly SessionPerf[]): number | null {
  if (sessions.length < 2) return null;
  const a = sessions[sessions.length - 2].e1rm, b = sessions[sessions.length - 1].e1rm;
  return a > 0 ? (b - a) / a : null;
}

/** Per-muscle performance trend: mean of its exercises' last-session e1RM change over the recent window. */
export function muscleTrend(workouts: readonly WorkoutLog[], muscle: Muscle, lookup: Lookup, sinceKey: string): number | null {
  const ids = new Set<string>();
  for (const w of workouts) if (w.finishedAt && w.dayKey >= sinceKey) for (const e of w.exercises) if (lookup(e.exerciseId)?.primary.includes(muscle)) ids.add(e.exerciseId);
  const changes: number[] = [];
  for (const id of ids) {
    const c = lastChange(exerciseSessions(workouts.filter(w => w.dayKey >= addDays(sinceKey, -28)), id));
    if (c !== null) changes.push(c);
  }
  return changes.length ? mean(changes) : null;
}

export interface MuscleFeedback { soreness: number | null; pump: number | null; volume: number | null; joint: number }

/** Feedback for a muscle from the logs of the basis week plus soreness records of those workouts. */
export function muscleFeedback(
  workouts: readonly WorkoutLog[], soreness: readonly SorenessRecord[], muscle: Muscle, weekStartKey: string, lookup: Lookup,
): MuscleFeedback {
  const end = addDays(weekStartKey, 7);
  const inWeek = workouts.filter(w => w.finishedAt && w.dayKey >= weekStartKey && w.dayKey < end);
  const pumps: number[] = [], vols: number[] = [];
  let joint = 0;
  for (const w of inWeek) for (const e of w.exercises) {
    if (!lookup(e.exerciseId)?.primary.includes(muscle)) continue;
    if (e.pump !== undefined) pumps.push(e.pump);
    if (e.volume !== undefined) vols.push(e.volume);
    if (e.jointPain !== undefined) joint = Math.max(joint, e.jointPain);
  }
  const ids = new Set(inWeek.map(w => w.id));
  const sore = soreness.filter(s => s.muscle === muscle && ids.has(s.workoutId)).map(s => s.level);
  return { soreness: sore.length ? mean(sore) : null, pump: pumps.length ? mean(pumps) : null, volume: vols.length ? mean(vols) : null, joint };
}

export const sessionsInWeek = (workouts: readonly WorkoutLog[], weekStartKey: string) =>
  workouts.filter(w => w.finishedAt && w.dayKey >= weekStartKey && w.dayKey < addDays(weekStartKey, 7));

export function plannedSessionCount(program: Program): number {
  return program.week.filter(id => id && program.sessions.some(s => s.id === id)).length;
}

export const adherence = (workouts: readonly WorkoutLog[], program: Program, weekStartKey: string): number | null => {
  const planned = plannedSessionCount(program);
  return planned === 0 ? null : Math.min(1, sessionsInWeek(workouts, weekStartKey).length / planned);
};

/** Days since the last finished workout, or null if there has never been one. */
export function gapDays(workouts: readonly WorkoutLog[], today: string): number | null {
  const f = finished(workouts);
  return f.length ? daysBetween(f[f.length - 1].dayKey, today) : null;
}

/** Smoothed body-weight slope as a fraction of body weight per week (EMA over the window); null when too little data. */
export function bodyWeightRate(points: readonly BodyWeightPoint[], today: string, windowDays: number, minPoints: number): number | null {
  const pts = [...points].filter(p => daysBetween(p.dayKey, today) <= windowDays && daysBetween(p.dayKey, today) >= 0).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  if (pts.length < minPoints) return null;
  const alpha = 2 / (7 + 1); // 7-day smoothing
  let ema = pts[0].kg;
  const smoothed = pts.map(p => (ema = alpha * p.kg + (1 - alpha) * ema));
  const days = Math.max(1, daysBetween(pts[0].dayKey, pts[pts.length - 1].dayKey));
  return ((smoothed[smoothed.length - 1] - smoothed[0]) / smoothed[0]) / (days / 7);
}
