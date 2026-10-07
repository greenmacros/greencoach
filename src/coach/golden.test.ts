import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { addDays } from "../program/schedule";
import { BENCH, CALF, CURL, INCLINE, LEGCURL, PUSHDOWN, ROW, SQUAT, profile, run, soreRecord, standardProgram, week, workout, type LogSpec } from "./fixtures";
import type { CoachPlan } from "./types";

/** Compact, stable view of a plan: what a user would see, without ids. Regenerate with UPDATE_GOLDEN=1. */
export function summarise(p: CoachPlan, nameOf: (id: string) => string) {
  return {
    mode: p.mode, deload: p.deload.type, newMeso: p.newMeso, mesoWeek: `${p.meso.week}/${p.meso.total}`, targetRir: p.targetRir,
    muscles: p.muscles.map(m => `${m.muscle}: ${m.lastSets} -> ${m.newSets} (${m.reason.key})`),
    slots: p.slots.map(s => `${nameOf(s.exerciseId)}: ${s.last.sets}x${s.last.repMin}-${s.last.repMax} @${s.last.weightKg ?? "-"} -> ${s.next.sets}x${s.next.repMin}-${s.next.repMax} (target ${s.next.targetReps}) @${s.next.weightKg ?? "-"} RIR${s.next.rir} rest${s.next.restSec} (${s.reason.key})`),
    swaps: p.swaps.map(s => `${nameOf(s.exerciseId)} <- ${s.reason.key}`),
    notes: p.notes.map(n => `${n.kind}:${n.reason.key}`),
  };
}

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });
const nameOf = (id: string) => all.find(e => e.id === id)?.name.en ?? id;

function golden(name: string, plan: () => CoachPlan) {
  it(`golden: ${name}`, () => {
    const got = summarise(plan(), nameOf);
    const file = `src/coach/golden/${name}.json`;
    if (process.env.UPDATE_GOLDEN || !existsSync(file)) writeFileSync(file, JSON.stringify(got, null, 2) + "\n");
    expect(got).toEqual(JSON.parse(readFileSync(file, "utf8")));
  });
}

const L = (ex: string, w: number | null, r: number, rir: number, extra: Partial<LogSpec> = {}): LogSpec =>
  ({ ex, sets: [[w, r, rir], [w, r, rir], [w, r, rir]], ...extra });

describe("golden plans", () => {
  golden("intermediate-building-week3", () => {
    const upper = [L(BENCH, 80, 10, 2, { target: { repMin: 6, repMax: 10, rir: 2 }, pump: 1 }), L(INCLINE, 28, 11, 2, { target: { repMin: 8, repMax: 12, rir: 2 } }), L(ROW, 55, 12, 2, { target: { repMin: 8, repMax: 12, rir: 2 } }), L(CURL, 12, 14, 2, { target: { repMin: 10, repMax: 15, rir: 2 } }), L(PUSHDOWN, 30, 15, 1, { target: { repMin: 10, repMax: 15, rir: 2 } })];
    const lower = [L(SQUAT, 110, 7, 2, { target: { repMin: 5, repMax: 8, rir: 2 } }), L(LEGCURL, 45, 13, 2, { target: { repMin: 10, repMax: 15, rir: 2 } }), L(CALF, 90, 14, 3, { target: { repMin: 10, repMax: 15, rir: 2 } })];
    const ws = [workout(week(1), upper), workout(addDays(week(1), 3), lower), workout(week(2), upper), workout(addDays(week(2), 3), lower)];
    return run(all, { workouts: ws, soreness: [soreRecord(ws[2].id, "chest", 0), soreRecord(ws[3].id, "quadriceps", 2)] });
  });

  golden("beginner-cut-week2", () => {
    const upper = [L(BENCH, 40, 9, 2, { target: { repMin: 6, repMax: 10, rir: 3 } }), L(ROW, 35, 12, 3, { target: { repMin: 8, repMax: 12, rir: 3 } })];
    const ws = [workout(week(1), upper), workout(addDays(week(1), 3), [L(SQUAT, 50, 8, 3, { target: { repMin: 5, repMax: 8, rir: 3 } })])];
    return run(all, { today: addDays(week(1), 6), targetWeekStart: week(2), workouts: ws, profile: profile({ experience: "beginner", phase: "cut", goal: "cut" }) });
  });

  golden("advanced-strength-deload-week6", () => {
    const up = [L(BENCH, 140, 5, 0, { target: { repMin: 3, repMax: 6, rir: 0 } })];
    const lo = [L(SQUAT, 200, 5, 0, { target: { repMin: 3, repMax: 6, rir: 0 } })];
    const ws = [workout(week(5), up), workout(addDays(week(5), 3), lo)];
    return run(all, { today: addDays(week(5), 6), targetWeekStart: week(6), workouts: ws, profile: profile({ experience: "advanced", goal: "strength" }) });
  });

  golden("welcome-back-after-break", () => {
    const upper = [L(BENCH, 80, 8, 2), L(ROW, 55, 10, 2, { target: { repMin: 8, repMax: 12, rir: 2 } })];
    const ws = [workout(week(1), upper), workout(addDays(week(1), 3), [L(SQUAT, 100, 6, 2, { target: { repMin: 5, repMax: 8, rir: 2 } })])];
    return run(all, { today: addDays(week(1), 14), targetWeekStart: week(3), workouts: ws });
  });

  golden("first-week-no-data", () => run(all, { program: standardProgram(), profile: profile({ experience: "beginner" }) }));
});
