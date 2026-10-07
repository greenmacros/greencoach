/** Test helpers: build programs, workout histories and engine inputs without touching the database. */
import type { Exercise } from "../library/types";
import { substitutes } from "../library/search";
import { addDays, keyToDate } from "../program/schedule";
import type { Program, SessionTemplate } from "../program/types";
import { buildExerciseLog, emptySet } from "../workout/model";
import type { SetLog, WorkoutLog } from "../workout/types";
import type { CoachInput, CoachProfile } from "./types";
import { planNextWeek } from "./engine";
import { COACH_CONFIG } from "./config";
import type { SorenessRecord } from "../feedback/soreness";

export const BENCH = "Barbell_Bench_Press_-_Medium_Grip";
export const INCLINE = "Incline_Dumbbell_Press";
export const ROW = "Seated_Cable_Rows";
export const CURL = "Dumbbell_Bicep_Curl";
export const PUSHDOWN = "Triceps_Pushdown";
export const SQUAT = "Barbell_Squat";
export const LEGCURL = "Lying_Leg_Curls";
export const CALF = "Standing_Calf_Raises";
export const BANDROW = "x-band-row";
export const PULLUP = "Pullups";
export const SIDERAISE = "Side_Lateral_Raise";

/** Monday of week 1 of every fixture mesocycle. */
export const START = "2026-10-05";
export const week = (n: number) => addDays(START, (n - 1) * 7);

let uid = 0;
const id = (p: string) => `${p}${uid++}`;

export interface SlotSpec { ex: string; sets: number; lo: number; hi: number; rir?: number; rest?: number; weightKg?: number | null }

export function session(name: string, slots: SlotSpec[]): SessionTemplate {
  return {
    id: id("s-"), name,
    exercises: slots.map(s => ({ id: id("slot-"), exerciseId: s.ex, sets: s.sets, repMin: s.lo, repMax: s.hi, rir: s.rir ?? 2, restSec: s.rest ?? 120, notes: "", supersetGroup: null, weightKg: s.weightKg })),
  };
}

export function program(sessions: SessionTemplate[], week7: (number | null)[], over: Partial<Program> = {}): Program {
  return {
    id: "prog:fx", createdAt: "", updatedAt: "", schemaVersion: 1, name: "fx", active: true, templateId: null, sessions,
    week: week7.map(i => (i === null ? null : sessions[i].id)), accumulationWeeks: 5, mesoStartDayKey: START, ...over,
  };
}

/** Upper (chest/back/arms) on Monday, Lower (legs) on Thursday. */
export function standardProgram(over: Partial<Program> = {}): Program {
  return program([
    session("Upper", [
      { ex: BENCH, sets: 3, lo: 6, hi: 10 }, { ex: INCLINE, sets: 3, lo: 8, hi: 12 }, { ex: ROW, sets: 3, lo: 8, hi: 12 },
      { ex: CURL, sets: 3, lo: 10, hi: 15 }, { ex: PUSHDOWN, sets: 3, lo: 10, hi: 15 },
    ]),
    session("Lower", [{ ex: SQUAT, sets: 3, lo: 5, hi: 8, rest: 180 }, { ex: LEGCURL, sets: 3, lo: 10, hi: 15 }, { ex: CALF, sets: 3, lo: 10, hi: 15 }]),
  ], [0, null, null, 1, null, null, null], over);
}

export interface LogSpec {
  ex: string;
  /** [weightKg, reps, rir?] per working set. */
  sets: ([number | null, number] | [number | null, number, number])[];
  difficulty?: 1 | 2 | 3 | 4 | 5;
  pump?: 0 | 1 | 2 | 3;
  joint?: 0 | 1 | 2 | 3;
  volume?: 1 | 2 | 3 | 4;
  /** The target the user was given that session (defaults to RIR 2, range from sets). */
  target?: { repMin: number; repMax: number; rir: number };
}

export function workout(dayKey: string, logs: LogSpec[], over: Partial<WorkoutLog> = {}): WorkoutLog {
  const meso = Math.floor((keyToDate(dayKey).getTime() - keyToDate(START).getTime()) / 86_400_000 / 7) + 1;
  return {
    id: id("w-"), createdAt: "", updatedAt: "", schemaVersion: 1, dayKey, programId: "prog:fx", sessionId: null, sessionName: "",
    startedAt: `${dayKey}T10:00:00.000Z`, finishedAt: `${dayKey}T11:00:00.000Z`, unit: "kg", notes: "", mesoWeek: ((meso - 1) % 6) + 1,
    exercises: logs.map(l => {
      const sets: SetLog[] = l.sets.map(([w, r, rir]) => ({ ...emptySet(), weightKg: w, reps: r, rir: rir ?? null, done: true, doneAt: "x" }));
      return { ...buildExerciseLog(null, l.ex, []), sets, target: { sets: sets.length, ...(l.target ?? { repMin: 6, repMax: 10, rir: 2 }) }, difficulty: l.difficulty, pump: l.pump, jointPain: l.joint, volume: l.volume };
    }),
    ...over,
  };
}

export const profile = (over: Partial<CoachProfile> = {}): CoachProfile => ({ experience: "intermediate", goal: "muscle", phase: "maintain", equipment: "gym", region: "JP", weightUnit: "kg", ...over });

export function soreRecord(workoutId: string, muscle: SorenessRecord["muscle"], level: SorenessRecord["level"]): SorenessRecord {
  return { id: `sore:${workoutId}:${muscle}`, createdAt: "", updatedAt: "", schemaVersion: 1, kind: "soreness", workoutId, muscle, level, prevWorkoutId: "", dayKey: "" };
}

/** Run the engine for the default scenario: planning meso week 3 (target) from history of weeks 1-2. */
export function run(all: Exercise[], over: Partial<CoachInput> = {}) {
  const lookup = (x: string) => all.find(e => e.id === x);
  const input: CoachInput = {
    today: addDays(week(2), 6), // Sunday of week 2
    targetWeekStart: week(3),
    profile: profile(),
    program: standardProgram(),
    workouts: [],
    soreness: [],
    bodyWeights: [],
    rejections: [],
    lookup,
    substitutes: ex => substitutes(all, ex),
    config: COACH_CONFIG,
    ...over,
  };
  return planNextWeek(input);
}

export const slotFor = (plan: ReturnType<typeof run>, ex: string) => plan.slots.find(s => s.exerciseId === ex)!;
export const muscleFor = (plan: ReturnType<typeof run>, m: string) => plan.muscles.find(x => x.muscle === m)!;

/** A normal two-week history: Upper+Lower in week 1 and week 2, parametrised by the week-2 upper-body lifts. */
export function history(week2Upper: LogSpec[], opts: { week1Upper?: LogSpec[]; lower?: LogSpec[] } = {}): WorkoutLog[] {
  const lower = opts.lower ?? [
    { ex: SQUAT, sets: [[100, 6, 2], [100, 6, 2], [100, 5, 2]] }, { ex: LEGCURL, sets: [[40, 12, 2], [40, 12, 2], [40, 11, 2]] }, { ex: CALF, sets: [[80, 12, 2], [80, 12, 2], [80, 12, 2]] },
  ];
  const w1u = opts.week1Upper ?? week2Upper;
  return [
    workout(week(1), w1u), workout(addDays(week(1), 3), lower),
    workout(week(2), week2Upper), workout(addDays(week(2), 3), lower),
  ];
}
