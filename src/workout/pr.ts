import { estimate1RM, isWorkingSet } from "./model";
import type { SetLog, WorkoutLog } from "./types";

export type PRKind = "weight" | "e1rm" | "reps" | "volume";

export interface PR {
  workoutId: string;
  exerciseId: string;
  setId: string;
  kind: PRKind;
  value: number;
  /** The record this beat (null never happens: the first time is a baseline, not a PR). */
  previous: number;
}

/** Best marks seen so far for one exercise. `seen` is false until a first working set is recorded. */
export interface Bests {
  seen: boolean;
  weight: number;
  e1rm: number;
  volume: number;
  /** Most reps at an exact weight (key = kg to 2 decimals; bodyweight = "0.00"). */
  reps: Map<string, number>;
}

export const emptyBests = (): Bests => ({ seen: false, weight: 0, e1rm: 0, volume: 0, reps: new Map() });

const key = (kg: number | null) => (kg ?? 0).toFixed(2);
const EPS = 0.01;

/** Which records would this set break against `b`? A first-ever set sets a baseline and breaks nothing. */
export function checkSet(b: Bests, s: SetLog): { kind: PRKind; value: number; previous: number }[] {
  if (!b.seen || !isWorkingSet(s)) return [];
  const w = s.weightKg ?? 0, r = s.reps!;
  const out: { kind: PRKind; value: number; previous: number }[] = [];
  if (w > 0) {
    if (w > b.weight + EPS) out.push({ kind: "weight", value: w, previous: b.weight });
    const e = estimate1RM(w, r);
    if (e > b.e1rm + EPS) out.push({ kind: "e1rm", value: e, previous: b.e1rm });
  }
  const prevReps = b.reps.get(key(s.weightKg));
  if (prevReps !== undefined && r > prevReps) out.push({ kind: "reps", value: r, previous: prevReps });
  if (w > 0 && w * r > b.volume + EPS) out.push({ kind: "volume", value: w * r, previous: b.volume });
  return out;
}

export function applySet(b: Bests, s: SetLog): void {
  if (!isWorkingSet(s)) return;
  const w = s.weightKg ?? 0, r = s.reps!;
  b.seen = true;
  b.weight = Math.max(b.weight, w);
  if (w > 0) b.e1rm = Math.max(b.e1rm, estimate1RM(w, r));
  b.volume = Math.max(b.volume, w * r);
  const k = key(s.weightKg);
  b.reps.set(k, Math.max(b.reps.get(k) ?? 0, r));
}

/** Records for every finished workout, replayed in chronological order so each is judged against what came before. */
export function computeAllPRs(workouts: readonly WorkoutLog[]): Map<string, PR[]> {
  const bests = new Map<string, Bests>();
  const out = new Map<string, PR[]>();
  const done = workouts.filter(w => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const w of done) {
    const prs: PR[] = [];
    for (const e of w.exercises) {
      const b = bests.get(e.exerciseId) ?? emptyBests();
      bests.set(e.exerciseId, b);
      // Judge each set against the bests as of the start of this exercise block, then fold the whole block in,
      // so only one set per kind is credited (the first to break it, then later sets must beat that).
      for (const s of [...e.sets].filter(isWorkingSet)) {
        for (const hit of checkSet(b, s)) prs.push({ workoutId: w.id, exerciseId: e.exerciseId, setId: s.id, ...hit });
        applySet(b, s);
      }
    }
    out.set(w.id, prs);
  }
  return out;
}

/** Bests for an exercise from finished history (optionally excluding one workout). */
export function bestsFrom(workouts: readonly WorkoutLog[], exerciseId: string, excludeId?: string): Bests {
  const b = emptyBests();
  for (const w of [...workouts].filter(x => x.finishedAt && x.id !== excludeId).sort((x, y) => x.startedAt.localeCompare(y.startedAt)))
    for (const e of w.exercises) if (e.exerciseId === exerciseId) for (const s of e.sets) applySet(b, s);
  return b;
}

/** Live check when a set is ticked: history plus the sets already done earlier in this workout. */
export function livePRs(history: readonly WorkoutLog[], workout: WorkoutLog, exerciseLogId: string, setId: string): PR[] {
  const log = workout.exercises.find(e => e.id === exerciseLogId);
  if (!log) return [];
  const b = bestsFrom(history, log.exerciseId, workout.id);
  // earlier done sets of the same exercise in this workout (any block), in order
  for (const e of workout.exercises) {
    if (e.exerciseId !== log.exerciseId) continue;
    for (const s of e.sets) {
      if (s.id === setId) {
        const set = s;
        return checkSet(b, set).map(h => ({ workoutId: workout.id, exerciseId: log.exerciseId, setId, ...h }));
      }
      if (s.done) applySet(b, s);
    }
  }
  return [];
}

export const PR_PRIORITY: PRKind[] = ["weight", "e1rm", "reps", "volume"];
export const topPR = (prs: readonly PR[]): PR | undefined => [...prs].sort((a, b) => PR_PRIORITY.indexOf(a.kind) - PR_PRIORITY.indexOf(b.kind))[0];

/** For a workout (draft or finished): which sets broke which records, judged against history + earlier sets. */
export function prSetKinds(history: readonly WorkoutLog[], workout: WorkoutLog): Map<string, PRKind[]> {
  const bests = new Map<string, Bests>();
  const out = new Map<string, PRKind[]>();
  for (const e of workout.exercises) {
    let b = bests.get(e.exerciseId);
    if (!b) { b = bestsFrom(history, e.exerciseId, workout.id); bests.set(e.exerciseId, b); }
    for (const s of e.sets) {
      if (!s.done) continue;
      const hits = checkSet(b, s);
      if (hits.length) out.set(s.id, hits.map(h => h.kind));
      applySet(b, s);
    }
  }
  return out;
}
