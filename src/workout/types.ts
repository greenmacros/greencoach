import type { BaseRecord, WeightUnit } from "../db/types";

export type SetType = "normal" | "warmup" | "drop" | "myo" | "failure";
export const SET_TYPES: SetType[] = ["normal", "warmup", "drop", "myo", "failure"];

export interface SetLog {
  id: string;
  type: SetType;
  /** Canonical kilograms; converted for display, so history survives a kg/lb switch. */
  weightKg: number | null;
  reps: number | null;
  /** Reps in reserve reported for this set (0 = nothing left). */
  rir: number | null;
  done: boolean;
  doneAt: string | null;
}

export interface ExerciseTarget { sets: number; repMin: number; repMax: number; rir: number }

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  slotId: string | null;
  restSec: number;
  notes: string;
  supersetGroup: number | null;
  target: ExerciseTarget | null;
  sets: SetLog[];
  /** Quick feedback (milestone 5). */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  pump?: 0 | 1 | 2 | 3;
  jointPain?: 0 | 1 | 2 | 3;
}

/** A workout in progress (finishedAt === null) or finished. Stored in `workouts`. */
export interface WorkoutLog extends BaseRecord {
  dayKey: string;
  programId: string | null;
  sessionId: string | null;
  sessionName: string;
  startedAt: string;
  finishedAt: string | null;
  unit: WeightUnit;
  exercises: ExerciseLog[];
  notes: string;
  /** Mesocycle week when it was done (for the coach). */
  mesoWeek?: number;
  /** Whole-session feedback (milestone 5). */
  feel?: 1 | 2 | 3 | 4 | 5;
  sessionFatigue?: 1 | 2 | 3 | 4 | 5;
}
