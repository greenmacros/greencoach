import { COACH_CONFIG } from "../coach/config";
import { bandFor, type Modifiers } from "../coach/volume";
import type { Experience, Goal, Phase } from "../db/types";
import type { Exercise, Muscle } from "../library/types";
import { addDays, daysBetween, weekStart } from "../program/schedule";
import { estimate1RM, isWorkingSet, summarize } from "../workout/model";
import { computeAllPRs, type PR } from "../workout/pr";
import type { WorkoutLog } from "../workout/types";
import type { BodyMetricRecord, GoalRecord, Range } from "./types";

type Lookup = (id: string) => Exercise | undefined;

/** First day included in a range (null = all time). "week" means the current week so far. */
export function rangeStart(range: Range, today: string): string | null {
  switch (range) {
    case "week": return weekStart(today);
    case "month": return addDays(today, -29);
    case "3months": return addDays(today, -90);
    case "year": return addDays(today, -364);
    case "all": return null;
  }
}

export const inRange = (dayKey: string, start: string | null, today: string) => (start === null || dayKey >= start) && dayKey <= today;

export const finishedSorted = (ws: readonly WorkoutLog[]) => ws.filter(w => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

export interface ExercisePoint { dayKey: string; e1rm: number; topKg: number; topReps: number; sets: number }

/** Per-session best estimated 1RM (reps only, like PRs) and heaviest set for one exercise, oldest first. */
export function exerciseSeries(workouts: readonly WorkoutLog[], exerciseId: string): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const w of finishedSorted(workouts)) {
    const sets = w.exercises.filter(e => e.exerciseId === exerciseId).flatMap(e => e.sets.filter(isWorkingSet));
    const loaded = sets.filter(s => (s.weightKg ?? 0) > 0);
    if (!loaded.length) continue;
    const top = [...loaded].sort((a, b) => b.weightKg! - a.weightKg! || b.reps! - a.reps!)[0];
    out.push({ dayKey: w.dayKey, e1rm: Math.max(...loaded.map(s => estimate1RM(s.weightKg!, s.reps!))), topKg: top.weightKg!, topReps: top.reps!, sets: sets.length });
  }
  return out;
}

/** Exercises the user has logged, most sessions first. */
export function loggedExercises(workouts: readonly WorkoutLog[]): { exerciseId: string; sessions: number; last: string }[] {
  const m = new Map<string, { sessions: number; last: string }>();
  for (const w of finishedSorted(workouts)) {
    for (const id of new Set(w.exercises.filter(e => e.sets.some(isWorkingSet)).map(e => e.exerciseId))) {
      const cur = m.get(id) ?? { sessions: 0, last: "" };
      m.set(id, { sessions: cur.sessions + 1, last: w.dayKey });
    }
  }
  return [...m.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.sessions - a.sessions || b.last.localeCompare(a.last));
}

export interface WeekPoint { weekStart: string; volumeKg: number; sets: number; sessions: number }

/** Weekly totals for every week from the first in range to the current one (empty weeks included). */
export function weeklyTotals(workouts: readonly WorkoutLog[], start: string | null, today: string, lookup: Lookup): WeekPoint[] {
  const done = finishedSorted(workouts).filter(w => inRange(w.dayKey, start, today));
  const first = start ? weekStart(start) : done[0] ? weekStart(done[0].dayKey) : weekStart(today);
  const out: WeekPoint[] = [];
  for (let ws = first; ws <= today; ws = addDays(ws, 7)) {
    const inWeek = done.filter(w => w.dayKey >= ws && w.dayKey < addDays(ws, 7));
    let volumeKg = 0, sets = 0;
    for (const w of inWeek) { const s = summarize(w, lookup); volumeKg += s.volumeKg; sets += s.workingSets; }
    out.push({ weekStart: ws, volumeKg, sets, sessions: inWeek.length });
  }
  return out;
}

/** Weighted hard sets per muscle per week (primary 1, secondary 0.5), same counting as the coach. */
export function weeklyMuscleSets(workouts: readonly WorkoutLog[], start: string | null, today: string, lookup: Lookup): { weekStart: string; sets: Partial<Record<Muscle, number>> }[] {
  return weeklyTotals(workouts, start, today, lookup).map(({ weekStart: ws }) => {
    const sets: Partial<Record<Muscle, number>> = {};
    for (const w of finishedSorted(workouts).filter(x => x.dayKey >= ws && x.dayKey < addDays(ws, 7))) {
      for (const [m, n] of Object.entries(summarize(w, lookup).muscleSets) as [Muscle, number][]) sets[m] = (sets[m] ?? 0) + n;
    }
    return { weekStart: ws, sets };
  });
}

/** Landmarks for the user's profile (no season), for drawing the "productive range" on the sets chart. */
export function landmarksFor(experience: Experience, goal: Goal, phase: Phase) {
  const mods: Modifiers = {
    cfg: COACH_CONFIG, exp: COACH_CONFIG.experience[experience], goalMods: COACH_CONFIG.goal[goal], phaseMods: COACH_CONFIG.phase[phase],
    seasonMrv: 1, perfTolerance: 1, experience, goal, phase,
  };
  return (m: Muscle) => bandFor(m, mods);
}

/** Working sets per training day. */
export function dailySets(workouts: readonly WorkoutLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of finishedSorted(workouts)) m.set(w.dayKey, (m.get(w.dayKey) ?? 0) + w.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0));
  return m;
}

/** Consecutive weeks (ending this week, or last week if this one has none yet) with at least `perWeek` sessions. */
export function weekStreak(workouts: readonly WorkoutLog[], today: string, perWeek = 1): number {
  const days = finishedSorted(workouts).map(w => w.dayKey);
  const count = (ws: string) => days.filter(d => d >= ws && d < addDays(ws, 7)).length;
  let ws = weekStart(today);
  if (count(ws) < perWeek) ws = addDays(ws, -7);
  let n = 0;
  while (count(ws) >= perWeek) { n++; ws = addDays(ws, -7); }
  return n;
}

export interface SessionPoint { dayKey: string; minutes: number; name: string }

export function sessionDurations(workouts: readonly WorkoutLog[], start: string | null, today: string): SessionPoint[] {
  return finishedSorted(workouts).filter(w => inRange(w.dayKey, start, today)).map(w => ({
    dayKey: w.dayKey, name: w.sessionName,
    minutes: Math.max(0, Math.round((new Date(w.finishedAt!).getTime() - new Date(w.startedAt).getTime()) / 60_000)),
  }));
}

export interface PRPoint extends PR { dayKey: string }

export function prTimeline(workouts: readonly WorkoutLog[], start: string | null, today: string): PRPoint[] {
  const day = new Map(workouts.map(w => [w.id, w.dayKey]));
  return [...computeAllPRs(workouts).values()].flat().map(p => ({ ...p, dayKey: day.get(p.workoutId)! }))
    .filter(p => inRange(p.dayKey, start, today)).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** Exponential moving average with a 7-entry span, for the smoothed body-weight line. */
export function smoothWeights(points: readonly { dayKey: string; kg: number }[]): { dayKey: string; kg: number }[] {
  const sorted = [...points].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const alpha = 2 / (7 + 1);
  let ema = sorted[0]?.kg ?? 0;
  return sorted.map(p => ({ dayKey: p.dayKey, kg: (ema = alpha * p.kg + (1 - alpha) * ema) }));
}

export const weightPoints = (metrics: readonly BodyMetricRecord[]) =>
  metrics.filter(m => typeof m.weightKg === "number").map(m => ({ dayKey: m.dayKey, kg: m.weightKg! })).sort((a, b) => a.dayKey.localeCompare(b.dayKey));

/** Least-squares slope (units per day) through (day, value); null with fewer than 3 points or no spread. */
export function slopePerDay(points: readonly { dayKey: string; v: number }[]): number | null {
  if (points.length < 3) return null;
  const x0 = points[0].dayKey;
  const xs = points.map(p => daysBetween(x0, p.dayKey)), ys = points.map(p => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? null : num / den;
}

export interface GoalProgress {
  current: number | null;
  /** 0..1 */
  fraction: number;
  achieved: boolean;
  /** Projected day the target is reached at the recent rate; null if not trending toward it. */
  projected: string | null;
}

/** Progress for a goal from history and body metrics. Projections use the last 8 weeks only, and are capped at 2 years. */
export function goalProgress(g: GoalRecord, workouts: readonly WorkoutLog[], metrics: readonly BodyMetricRecord[], today: string): GoalProgress {
  const since = addDays(today, -56);
  const project = (pts: { dayKey: string; v: number }[], current: number, target: number): string | null => {
    const slope = slopePerDay(pts.filter(p => p.dayKey >= since));
    if (slope === null || slope === 0 || Math.sign(target - current) !== Math.sign(slope)) return null;
    const days = Math.ceil((target - current) / slope);
    return days > 0 && days <= 730 ? addDays(today, days) : null;
  };
  if (g.kind === "lift" && g.exerciseId && g.targetKg) {
    const series = exerciseSeries(workouts, g.exerciseId);
    const current = series.length ? Math.max(...series.map(p => p.e1rm)) : null;
    const achieved = current !== null && current >= g.targetKg;
    return {
      current, achieved, fraction: current === null ? 0 : Math.min(1, current / g.targetKg),
      projected: achieved || current === null ? null : project(series.map(p => ({ dayKey: p.dayKey, v: p.e1rm })), current, g.targetKg),
    };
  }
  if (g.kind === "bodyweight" && g.targetKg) {
    const pts = weightPoints(metrics);
    const sm = smoothWeights(pts);
    const current = sm.length ? sm[sm.length - 1].kg : null;
    const start = g.startKg ?? pts[0]?.kg ?? current;
    if (current === null || start == null) return { current, fraction: 0, achieved: false, projected: null };
    const total = g.targetKg - start;
    const achieved = total === 0 || (total < 0 ? current <= g.targetKg : current >= g.targetKg);
    const fraction = total === 0 ? 1 : Math.min(1, Math.max(0, (current - start) / total));
    return { current, fraction, achieved, projected: achieved ? null : project(sm.map(p => ({ dayKey: p.dayKey, v: p.kg })), current, g.targetKg) };
  }
  if (g.kind === "sessions" && g.perWeek) {
    const ws = weekStart(today);
    const current = finishedSorted(workouts).filter(w => w.dayKey >= ws && w.dayKey <= today).length;
    return { current, fraction: Math.min(1, current / g.perWeek), achieved: current >= g.perWeek, projected: null };
  }
  return { current: null, fraction: 0, achieved: false, projected: null };
}
