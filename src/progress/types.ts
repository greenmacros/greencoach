import type { BaseRecord } from "../db/types";

/** One body-measurement entry (stored in `bodyMetrics`, id `bm:<uuid>`). Lengths in cm, weight in kg. */
export interface BodyMetricRecord extends BaseRecord {
  dayKey: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  hipsCm?: number;
  thighsCm?: number;
  notes?: string;
}

/** A progress photo, compressed on the device and never uploaded (stored in `bodyMetrics`, id `photo:<uuid>`). */
export interface PhotoRecord extends BaseRecord {
  dayKey: string;
  dataUrl: string;
  pose?: "front" | "side" | "back";
}

export type GoalKind = "lift" | "bodyweight" | "sessions";

/** Stored in `goals`. */
export interface GoalRecord extends BaseRecord {
  kind: GoalKind;
  exerciseId?: string;
  /** lift: target estimated 1RM; bodyweight: target body weight. */
  targetKg?: number;
  /** bodyweight: weight when the goal was set, so progress has a direction. */
  startKg?: number;
  /** sessions: target sessions per week. */
  perWeek?: number;
  targetDate?: string;
  achievedAt?: string | null;
}

export type Range = "week" | "month" | "3months" | "year" | "all";
export const RANGES: Range[] = ["week", "month", "3months", "year", "all"];

export const MEASURES = ["waistCm", "chestCm", "armsCm", "hipsCm", "thighsCm"] as const;
export type Measure = (typeof MEASURES)[number];
