import type { Equipment, Experience, Goal, Phase, WeightUnit } from "../db/types";
import type { SorenessRecord } from "../feedback/soreness";
import type { Exercise, Muscle } from "../library/types";
import type { Program } from "../program/types";
import type { WorkoutLog } from "../workout/types";
import type { Region } from "./seasons";
import type { CoachConfig } from "./config";

/** A translatable explanation: `key` is an i18n key under `why.*`, `params` fill its placeholders. */
export interface Reason { key: string; params?: Record<string, string | number> }

export type Trend = "up" | "same" | "down";

export interface CoachProfile {
  experience: Experience;
  goal: Goal;
  phase: Phase;
  equipment: Equipment;
  region: Region;
  weightUnit: WeightUnit;
}

export interface BodyWeightPoint { dayKey: string; kg: number }

/** What the user did with a past suggestion. Rejections damp the same kind of suggestion for a while. */
export interface Rejection {
  weekKey: string;
  scope: "slot" | "muscle";
  /** Slot id or muscle name. */
  id: string;
  kind: "load" | "sets";
}

export interface CoachInput {
  /** Local training day key "today". */
  today: string;
  /** Monday of the week being planned. */
  targetWeekStart: string;
  profile: CoachProfile;
  program: Program;
  /** Finished workouts (drafts are ignored). */
  workouts: readonly WorkoutLog[];
  soreness: readonly SorenessRecord[];
  bodyWeights: readonly BodyWeightPoint[];
  rejections: readonly Rejection[];
  /** The user's bands, lightest first (for band exercises). */
  bands?: readonly { id: string; name: string }[];
  lookup: (id: string) => Exercise | undefined;
  /** Same-muscle, same-pattern alternatives available to the user (used for joint-pain swaps). */
  substitutes: (ex: Exercise) => Exercise[];
  config?: CoachConfig;
}

export interface Band { mv: number; mev: number; mavLow: number; mavHigh: number; mrv: number }

export interface MuscleSuggestion {
  muscle: Muscle;
  /** Weighted hard sets in last week's plan. */
  lastSets: number;
  /** Weighted hard sets in the proposed plan (after allocation to exercises). */
  newSets: number;
  delta: number;
  /** What the engine wanted before allocation limits. */
  wanted: number;
  band: Band;
  reason: Reason;
  /** Extra detail lines. */
  extra: Reason[];
  /** Sets that could not be placed (positive) or removed (negative) because of session/exercise limits. */
  unallocated: number;
}

export interface SlotState {
  sets: number; repMin: number; repMax: number; rir: number; restSec: number; weightKg: number | null;
  /** Band(s) for band exercises. */
  bands?: string[] | null;
}

export interface SlotSuggestion {
  sessionId: string;
  slotId: string;
  exerciseId: string;
  last: SlotState;
  next: SlotState & { targetReps: number };
  trend: { sets: Trend; weight: Trend; reps: Trend; rir: Trend };
  reason: Reason;
  extra: Reason[];
}

export interface SwapSuggestion {
  sessionId: string;
  slotId: string;
  exerciseId: string;
  candidates: string[];
  reason: Reason;
}

export interface CoachNote { kind: "info" | "warn" | "good"; reason: Reason }

export type PlanMode = "first" | "normal" | "deload" | "welcome-back" | "ramp";

export interface CoachPlan {
  targetWeekStart: string;
  basisWeekStart: string;
  meso: { week: number; total: number; isDeload: boolean; cycle: number };
  /** The week-1 plan of a new mesocycle (volume restarts from the individual starting point). */
  newMeso: boolean;
  mode: PlanMode;
  deload: { type: "scheduled" | "early" | null; reasons: Reason[] };
  targetRir: number;
  muscles: MuscleSuggestion[];
  slots: SlotSuggestion[];
  swaps: SwapSuggestion[];
  notes: CoachNote[];
}
