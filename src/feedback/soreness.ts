import type { BaseRecord } from "../db/types";
import type { Exercise, Muscle } from "../library/types";
import { daysBetween } from "../program/schedule";
import { isWorkingSet } from "../workout/model";
import type { WorkoutLog } from "../workout/types";

/** 0 = healed before today's session, 1 = healed just in time, 2 = still sore. Stored in `feedback`. */
export type SorenessLevel = 0 | 1 | 2;

export interface SorenessRecord extends BaseRecord {
  kind: "soreness";
  workoutId: string;
  muscle: Muscle;
  level: SorenessLevel;
  /** The earlier session this rating is about. */
  prevWorkoutId: string;
  dayKey: string;
}

export const sorenessId = (workoutId: string, muscle: Muscle) => `sore:${workoutId}:${muscle}`;

export interface SorenessQuestion { muscle: Muscle; prevWorkoutId: string; daysAgo: number }

export const SORENESS_WINDOW_DAYS = 14;

/**
 * Which muscles to ask about at the start of a session: the ones this session trains (primary muscles),
 * that were trained in an earlier finished session within the last two weeks. One question per muscle.
 */
export function sorenessQuestions(
  current: WorkoutLog,
  history: readonly WorkoutLog[],
  lookup: (id: string) => Exercise | undefined,
): SorenessQuestion[] {
  const muscles = new Set<Muscle>();
  for (const e of current.exercises) for (const m of lookup(e.exerciseId)?.primary ?? []) muscles.add(m);
  const earlier = history
    .filter(w => w.finishedAt && w.id !== current.id && w.startedAt < current.startedAt && w.dayKey < current.dayKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const out: SorenessQuestion[] = [];
  for (const m of muscles) {
    const prev = earlier.find(w => w.exercises.some(e => lookup(e.exerciseId)?.primary.includes(m) && e.sets.some(isWorkingSet)));
    if (!prev) continue;
    const daysAgo = daysBetween(prev.dayKey, current.dayKey);
    if (daysAgo >= 1 && daysAgo <= SORENESS_WINDOW_DAYS) out.push({ muscle: m, prevWorkoutId: prev.id, daysAgo });
  }
  return out.sort((a, b) => a.daysAgo - b.daysAgo || a.muscle.localeCompare(b.muscle));
}
