import type { Experience, Goal, Phase } from "../db/types";
import type { Muscle } from "../library/types";

/**
 * Every tunable number of the coach lives here. Rules reference these names; nothing is hard-coded in the logic.
 * See README.md for the rationale behind each value.
 */

export interface Landmark { mv: number; mev: number; mavLow: number; mavHigh: number; mrv: number }

/** Hard sets per muscle per week for an intermediate lifter. Inspired by the public RP volume landmark concept. */
const LANDMARKS: Record<Muscle, Landmark> = {
  chest: { mv: 6, mev: 10, mavLow: 12, mavHigh: 20, mrv: 22 },
  shoulders: { mv: 6, mev: 8, mavLow: 16, mavHigh: 22, mrv: 26 },
  triceps: { mv: 4, mev: 6, mavLow: 10, mavHigh: 14, mrv: 18 },
  biceps: { mv: 4, mev: 8, mavLow: 14, mavHigh: 20, mrv: 26 },
  forearms: { mv: 0, mev: 2, mavLow: 6, mavHigh: 10, mrv: 16 },
  lats: { mv: 6, mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  "middle-back": { mv: 6, mev: 8, mavLow: 12, mavHigh: 20, mrv: 25 },
  traps: { mv: 0, mev: 0, mavLow: 6, mavHigh: 12, mrv: 16 },
  "lower-back": { mv: 0, mev: 0, mavLow: 4, mavHigh: 8, mrv: 10 },
  abdominals: { mv: 0, mev: 4, mavLow: 8, mavHigh: 16, mrv: 20 },
  quadriceps: { mv: 6, mev: 8, mavLow: 12, mavHigh: 18, mrv: 20 },
  hamstrings: { mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  glutes: { mv: 0, mev: 2, mavLow: 8, mavHigh: 12, mrv: 16 },
  calves: { mv: 6, mev: 8, mavLow: 12, mavHigh: 16, mrv: 20 },
  adductors: { mv: 0, mev: 0, mavLow: 4, mavHigh: 8, mrv: 12 },
  abductors: { mv: 0, mev: 0, mavLow: 4, mavHigh: 8, mrv: 12 },
  neck: { mv: 0, mev: 0, mavLow: 2, mavHigh: 6, mrv: 8 },
};

export interface ExperienceMods {
  /** Multipliers on the landmark values. */
  mev: number; mav: number; mrv: number;
  /** Most sets a muscle may gain in one week. */
  maxSetStep: number;
  /** Most increments a lift may jump in one week. */
  maxLoadSteps: number;
  /** Extra sets above MEV in week 1 of a mesocycle. */
  startBonus: number;
}

export const COACH_CONFIG = {
  /** An exercise skipped in this many of the last `of` sessions of its day gets a "make optional or drop" question. */
  dropAfterSkips: { skipped: 3, of: 4, askAgainDays: 28 },
  /** How much a secondary muscle counts toward its weekly hard sets. */
  secondaryWeight: 0.5,
  landmarks: LANDMARKS,

  experience: {
    beginner: { mev: 1, mav: 0.8, mrv: 0.8, maxSetStep: 1, maxLoadSteps: 2, startBonus: 0 },
    intermediate: { mev: 1, mav: 1, mrv: 1, maxSetStep: 2, maxLoadSteps: 1, startBonus: 0 },
    advanced: { mev: 1.1, mav: 1.15, mrv: 1.2, maxSetStep: 2, maxLoadSteps: 1, startBonus: 2 },
  } satisfies Record<Experience, ExperienceMods>,

  /** Goal modifiers. `mavMult`/`mrvMult` scale the ceilings; `volumeFocus` 0..1 is how far past MEV volume may climb. */
  goal: {
    muscle: { mavMult: 1, mrvMult: 1, volumeFocus: 1, strengthRanges: false },
    strength: { mavMult: 0.75, mrvMult: 0.8, volumeFocus: 0.5, strengthRanges: true },
    cut: { mavMult: 0.85, mrvMult: 0.85, volumeFocus: 0.6, strengthRanges: false },
    maintain: { mavMult: 0.7, mrvMult: 0.8, volumeFocus: 0.25, strengthRanges: false },
    recomp: { mavMult: 0.95, mrvMult: 0.95, volumeFocus: 0.85, strengthRanges: false },
  } satisfies Record<Goal, { mavMult: number; mrvMult: number; volumeFocus: number; strengthRanges: boolean }>,

  /** Phase modifiers. `holdVolume`: never add sets above last week's plan unless below MEV. */
  phase: {
    bulk: { mrvMult: 1.1, holdVolume: false, loadBonusSteps: 1, loadDropTolerance: 0 },
    maintain: { mrvMult: 1, holdVolume: false, loadBonusSteps: 0, loadDropTolerance: 0 },
    cut: { mrvMult: 0.85, holdVolume: true, loadBonusSteps: 0, loadDropTolerance: 0.05 },
  } satisfies Record<Phase, { mrvMult: number; holdVolume: boolean; loadBonusSteps: number; loadDropTolerance: number }>,

  strength: {
    /** Main compound lifts get these ranges when the goal is strength. */
    compoundRange: [3, 6] as [number, number],
    isolationRange: [8, 12] as [number, number],
    compoundRestSec: 210,
    mainPatterns: ["squat", "hinge", "h-push", "v-press", "lunge"] as string[],
  },

  /** Target RIR by accumulation week (index = week - 1), keyed by number of accumulation weeks. */
  rirLadder: {
    3: [3, 2, 1],
    4: [3, 2, 1, 0],
    5: [3, 2, 2, 1, 0],
    6: [3, 3, 2, 2, 1, 0],
    7: [3, 3, 2, 2, 1, 1, 0],
    8: [3, 3, 2, 2, 2, 1, 1, 0],
  } as Record<number, number[]>,

  deload: {
    volumeFactor: 0.5,
    rir: 5,
    loadFactor: 0.9,
    /** Early deload when 2+ muscles regress across their last 2 sessions. */
    regressMuscles: 2,
    regressSessions: 2,
    /** A session counts as regressed when e1RM falls by more than this vs the previous session. */
    regressDrop: 0.025,
    /** High accumulated fatigue: average session fatigue (1-5) over the last N sessions. */
    fatigueAvg: 4,
    fatigueSessions: 3,
    /** Or: average soreness level (0-3) of asked muscles this high AND average difficulty (1-5) this high. */
    soreAvg: 2.5,
    difficultyAvg: 4,
    /** Do not call an early deload before this mesocycle week (needs data). */
    minMesoWeek: 3,
  },

  volume: {
    /** Cap on hard sets for one muscle in one session. */
    sessionCap: 10,
    maxSetsPerExercise: 6,
    minSetsCompound: 2,
    minSetsIsolation: 1,
    /** Sets added when the muscle is fully recovered, flat and under-pumped. */
    bigStep: 2,
    smallStep: 1,
    /** Below this adherence (done/planned sessions) volume is held. */
    minAdherence: 0.6,
    /** Soreness thresholds are on the 0-3 scale. */
    soreHigh: 2.5,
    soreOk: 1,
    pumpLow: 1,
    pumpHigh: 2,
    volumeTooMuch: 3.5,
    volumeNotEnough: 1.5,
    perfDrop: -0.02,
    jointHold: 2,
    jointCut: 3,
  },

  load: {
    /** Smallest increments in kg by equipment; dumbbells step finer under `dumbbellLight`. */
    inc: { barbell: 2.5, barbellLower: 5, ezBar: 2.5, smith: 2.5, dumbbell: 2, dumbbellLight: 1, cable: 2.5, machine: 2.5, machineHeavy: 5, kettlebell: 2, landmine: 2.5, bodyweightLoad: 2.5 },
    /** Same increments in lb (converted to kg when the user trains in lb). */
    incLb: { barbell: 5, barbellLower: 10, ezBar: 5, smith: 5, dumbbell: 5, dumbbellLight: 2.5, cable: 5, machine: 5, machineHeavy: 10, kettlebell: 4, landmine: 5, bodyweightLoad: 5 },
    dumbbellLightBelowKg: 12,
    lowerHeavyKg: 80,
    machineHeavyKg: 100,
    /** RIR gap that counts as "much lower/higher than target". */
    rirGap: 2,
    /** Back-off when the lift was much harder than planned. */
    backoffMin: 0.025,
    backoffMax: 0.05,
    /** Percent drop in reps below the range that triggers a back-off. */
    belowRangeRepsGap: 2,
    /** Plateau: no e1RM gain of at least this fraction across the last N sessions. */
    plateauSessions: 4,
    plateauGain: 0.005,
    /** Sessions older than this many days are not "last time" for progression. */
    staleDays: 21,
    difficultyHard: 5,
    difficultyEasy: 1,
    jointHold: 2,
    jointDrop: 3,
    jointDropFactor: 0.9,
  },

  /** Returning after a break. */
  gap: {
    welcomeBackDays: 7,
    rampDays: 21,
    /** Load factor at 7 days and at 21 days (linear in between). */
    loadFactorStart: 0.95,
    loadFactorEnd: 0.9,
    rampLoadFactor: 0.88,
    rampRir: 4,
  },

  /** Body weight guard rails. Rates are fractions of body weight per week. */
  bodyWeight: {
    window: 14,
    cutMaxLossPerWeek: 0.01,
    bulkMaxGainPerWeek: 0.0075,
    minPoints: 4,
  },

  /** How long a rejected increase is respected, in weeks. */
  rejectCooldownWeeks: 2,

  rest: {
    compoundSec: 150,
    isolationSec: 90,
    minSec: 45,
  },
} as const;

export type CoachConfig = typeof COACH_CONFIG;
