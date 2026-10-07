import { beforeAll, describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { addDays } from "../program/schedule";
import { applyDecisions, toRecords, type Decision } from "./apply";
import { autoAction, changesOf, undoProgram } from "./auto";
import { BENCH, history, run, standardProgram, week, workout } from "./fixtures";

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });

const strongBench = () => history([{ ex: BENCH, sets: [[80, 10, 2], [80, 10, 2], [80, 10, 2]], target: { repMin: 6, repMax: 10, rir: 2 } }]);

describe("automatic coaching", () => {
  it("applies an ordinary week and lists only what actually changes", () => {
    const plan = run(all, { workouts: strongBench() });
    expect(autoAction(plan)).toBe("apply");
    const changes = changesOf(plan);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => JSON.stringify(c.before) !== JSON.stringify(c.after))).toBe(true);
    expect(changes.find(c => c.exerciseId === BENCH)!.after.weightKg).toBeGreaterThan(80);
  });

  it("never applies a first plan: the user's own program is the start", () => {
    expect(autoAction(run(all, { workouts: [] }))).toBe("skip");
  });

  it("waits for the user after a break", () => {
    const old = [workout(addDays(week(1), -30), [{ ex: BENCH, sets: [[80, 8, 2]] }])];
    const plan = run(all, { workouts: old });
    expect(["ramp", "welcome-back"]).toContain(plan.mode);
    expect(autoAction(plan)).toBe("review");
  });

  it("undo puts the previous values back, slot by slot", () => {
    const prog = standardProgram();
    const plan = run(all, { program: prog, workouts: strongBench() });
    const decisions = new Map<string, Decision>(plan.slots.map(s => [s.slotId, { status: "accepted" }]));
    const applied = applyDecisions(prog, plan, decisions);
    const ids = new Set(toRecords(plan, decisions, () => "chest").map(r => r.slotId));
    const undone = undoProgram(applied, prog, ids);
    const strip = (p: typeof prog) => p.sessions.map(s => s.exercises.map(e => [e.sets, e.repMin, e.repMax, e.rir, e.restSec, e.weightKg ?? null]));
    expect(strip(undone)).toEqual(strip(prog));
  });
});
