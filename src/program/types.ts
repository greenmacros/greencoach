import type { BaseRecord } from "../db/types";

export interface ExerciseSlot {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Target reps in reserve for the first accumulation week; the coach moves it along the mesocycle. */
  rir: number;
  restSec: number;
  notes: string;
  /** Slots sharing the same non-null group number are performed as a superset. */
  supersetGroup: number | null;
}

export interface SessionTemplate {
  id: string;
  name: string;
  exercises: ExerciseSlot[];
}

/** Stored in the `programs` table with id `prog:<uuid>`. */
export interface Program extends BaseRecord {
  name: string;
  active: boolean;
  templateId: string | null;
  sessions: SessionTemplate[];
  /** Monday..Sunday: session id or null (rest). */
  week: (string | null)[];
  /** Accumulation weeks before the deload week (3..8). The mesocycle is this + 1 deload week. */
  accumulationWeeks: number;
  /** Local day key of the Monday of week 1. */
  mesoStartDayKey: string;
}

/**
 * A one-off change to a single calendar day, stored in `programs` with id `ovr:<dayKey>`.
 * `sessionId: null` means rest. `skipped` keeps the planned session visible but not due.
 */
export interface DayOverride extends BaseRecord {
  dayKey: string;
  sessionId: string | null;
  skipped: boolean;
}

export const PROGRAM_PREFIX = "prog:";
export const OVERRIDE_PREFIX = "ovr:";

export const MESO_MIN = 3;
export const MESO_MAX = 8;
