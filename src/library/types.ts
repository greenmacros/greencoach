import type { BaseRecord } from "../db/types";

export const MUSCLES = [
  "chest", "shoulders", "triceps", "biceps", "forearms", "lats", "middle-back", "traps", "lower-back",
  "abdominals", "quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors", "neck",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  "barbell", "dumbbell", "cable", "machine", "smith", "ez-bar", "kettlebell", "bands", "bodyweight",
  "pullup-bar", "bench", "trx", "landmine", "dip-bars", "other",
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number];

export const PATTERNS = [
  "squat", "hinge", "lunge", "h-push", "v-press", "h-pull", "v-pull", "fly", "shoulder-raise",
  "elbow-flexion", "elbow-extension", "knee-extension", "knee-flexion", "calf", "shrug", "core",
  "rotation", "hip-abduction", "grip", "neck", "carry", "olympic", "plyo", "cardio", "mobility", "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export type JointNote = "shoulder" | "lower-back" | "knee" | "elbow" | "wrist" | "neck";

/** Optional media a user (or a later release) can attach. Real GIF/MP4 beats the two-frame images. */
export interface Media { kind: "gif" | "mp4" | "image"; url: string }

/** An exercise as the UI sees it (bundled or custom). */
export interface Exercise {
  id: string;
  name: { en: string; ja: string };
  primary: Muscle[];
  secondary: Muscle[];
  equipment: EquipmentId[];
  pattern: Pattern;
  mechanic: "compound" | "isolation" | null;
  difficulty: 1 | 2 | 3;
  /** 1 (light) .. 5 (very taxing); the coach uses this for fatigue accounting. */
  fatigue: 1 | 2 | 3 | 4 | 5;
  category: string;
  joints: JointNote[];
  /** Number of bundled frames (0, 1 or 2): /ex/<id>-0.webp, -1.webp */
  frames: number;
  media?: Media;
  custom?: boolean;
  /** Free-text notes (custom exercises). */
  notes?: string;
  /** Per-exercise default rest in seconds (user override). */
  restSec?: number;
}

/** Row shape of the bundled index.json (short keys keep it small). */
export interface IndexRow {
  id: string; n: string; j: string; p: Muscle[]; s: Muscle[]; e: EquipmentId[]; pat: Pattern;
  m: "c" | "i" | null; d: 1 | 2 | 3; f: 1 | 2 | 3 | 4 | 5; cat: string; img: number; jt: JointNote[];
}

/** User-created exercise, stored in the `exercises` table. */
export interface CustomExerciseRecord extends BaseRecord {
  nameEn: string;
  nameJa: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: EquipmentId[];
  pattern: Pattern;
  mechanic: "compound" | "isolation";
  fatigue: 1 | 2 | 3 | 4 | 5;
  notes: string;
  /** Small compressed data: URL of an optional photo. */
  photo?: string;
  favorite?: boolean;
  restSec?: number;
}

/** Per-user flags on bundled exercises (favorites, recents), stored in the `exercises` table with id `flag:<exerciseId>`. */
export interface ExerciseFlagRecord extends BaseRecord {
  exerciseId: string;
  favorite: boolean;
  lastUsedAt: string | null;
  restSec?: number;
}
