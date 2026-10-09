import type { SorenessRecord } from "../feedback/soreness";
import type { Exercise, Muscle } from "../library/types";
import { addDays } from "../program/schedule";
import type { WorkoutLog } from "../workout/types";
import type { CoachConfig } from "./config";
import { exerciseSessions, finished, mean } from "./stats";
import type { Reason } from "./types";
import { MUSCLES } from "../library/types";

const P = (key: string, params?: Reason["params"]): Reason => ({ key, params });

/** Fractional e1RM change into each of the last two sessions of an exercise (needs 3 sessions). */
function lastTwoChanges(sessions: ReturnType<typeof exerciseSessions>): [number, number] | null {
  const n = sessions.length;
  if (n < 3) return null;
  const e = (i: number) => sessions[i].e1rm;
  if (e(n - 2) <= 0 || e(n - 3) <= 0) return null;
  return [(e(n - 2) - e(n - 3)) / e(n - 3), (e(n - 1) - e(n - 2)) / e(n - 2)];
}

/** Muscles whose lifts got worse in each of their last two sessions. */
export function regressedMuscles(workouts: readonly WorkoutLog[], lookup: (id: string) => Exercise | undefined, cfg: CoachConfig, tolerance: number): Muscle[] {
  const byMuscle = new Map<Muscle, { c0: number[]; c1: number[] }>();
  const ids = new Set(workouts.flatMap(w => w.exercises.map(e => e.exerciseId)));
  for (const id of ids) {
    const ex = lookup(id);
    if (!ex) continue;
    const ch = lastTwoChanges(exerciseSessions(workouts, id));
    if (!ch) continue;
    const m = ex.primary[0];
    const cur = byMuscle.get(m) ?? { c0: [], c1: [] };
    cur.c0.push(ch[0]); cur.c1.push(ch[1]);
    byMuscle.set(m, cur);
  }
  const lim = -cfg.deload.regressDrop * tolerance;
  return MUSCLES.filter(m => {
    const c = byMuscle.get(m);
    return !!c && mean(c.c0) < lim && mean(c.c1) < lim;
  });
}

/** Why an early deload is warranted (empty = it is not). Looks only at sessions outside deload weeks. */
export function earlyDeloadReasons(args: {
  perfWorkouts: readonly WorkoutLog[];
  allWorkouts: readonly WorkoutLog[];
  soreness: readonly SorenessRecord[];
  lookup: (id: string) => Exercise | undefined;
  cfg: CoachConfig;
  tolerance: number;
  today: string;
}): Reason[] {
  const { cfg } = args;
  const d = cfg.deload;
  const reasons: Reason[] = [];

  const regressed = regressedMuscles(args.perfWorkouts, args.lookup, cfg, args.tolerance);
  if (regressed.length >= d.regressMuscles) reasons.push(P("why.deload.early.perf", { n: regressed.length, muscles: regressed.slice(0, 3).join(", ") }));

  const recent = finished(args.allWorkouts).filter(w => w.sessionFatigue !== undefined).slice(-d.fatigueSessions);
  if (recent.length === d.fatigueSessions) {
    const avg = mean(recent.map(w => w.sessionFatigue!));
    if (avg >= d.fatigueAvg) reasons.push(P("why.deload.early.fatigue", { avg: Math.round(avg * 10) / 10 }));
  }

  const slept = finished(args.allWorkouts).filter(w => w.sleep !== undefined).slice(-d.sleepOf);
  const poorNights = slept.filter(w => w.sleep === 1).length;
  if (slept.length >= d.sleepPoor && poorNights >= d.sleepPoor) reasons.push(P("why.deload.early.sleep", { poor: poorNights, n: slept.length }));

  const since = addDays(args.today, -14);
  const recentW = finished(args.allWorkouts).filter(w => w.dayKey >= since);
  const ids = new Set(recentW.map(w => w.id));
  const sore = args.soreness.filter(s => ids.has(s.workoutId)).map(s => s.level);
  const diffs = recentW.flatMap(w => w.exercises.map(e => e.difficulty)).filter((x): x is 1 | 2 | 3 | 4 | 5 => x !== undefined);
  if (sore.length >= 3 && diffs.length >= 3 && mean(sore) >= d.soreAvg && mean(diffs) >= d.difficultyAvg) {
    reasons.push(P("why.deload.early.sore", { sore: Math.round(mean(sore) * 10) / 10, diff: Math.round(mean(diffs) * 10) / 10 }));
  }
  return reasons;
}
