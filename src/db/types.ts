export const SCHEMA_VERSION = 1;

/** Every stored record carries these. Dates are ISO strings in UTC. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export type Lang = "en" | "ja";
export type ThemePref = "system" | "light" | "dark";
export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";

export interface Settings extends BaseRecord {
  lang: Lang;
  theme: ThemePref;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  /** Hour (0-23) at which a new training day starts; 4 means 02:00 still counts as "yesterday". */
  dayStartHour: number;
  region: "JP" | "north" | "south";
  backupReminderDays: number;
  lastBackupAt: string | null;
  keepAwake: boolean;
  restSound: boolean;
  restVibrate: boolean;
  restNotify: boolean;
  onboarded: boolean;
}

export type Goal = "muscle" | "cut" | "strength" | "maintain" | "recomp";
export type Phase = "bulk" | "cut" | "maintain";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "home" | "bands" | "dumbbells" | "gym";

export interface Profile extends BaseRecord {
  sex?: "male" | "female" | "other";
  age?: number;
  bodyWeightKg?: number;
  heightCm?: number;
  experience: Experience;
  goal: Goal;
  phase: Phase;
  daysPerWeek: number;
  equipment: Equipment;
}

/** Tables that hold user data. Later milestones give these concrete record types. */
export const TABLES = [
  "profile",
  "settings",
  "exercises",
  "programs",
  "mesocycles",
  "workouts",
  "feedback",
  "bodyMetrics",
  "goals",
  "suggestions",
  "timerPresets",
] as const;
export type TableName = (typeof TABLES)[number];

export type AnyRecord = BaseRecord & Record<string, unknown>;

export interface BackupFile {
  app: "GreenCoach";
  version: number;
  exportedAt: string;
  counts: Record<string, number>;
  tables: Record<string, AnyRecord[]>;
}

export type ImportMode = "merge" | "replace";
