import { describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import type { SessionTemplate } from "../program/types";
import {
  addSetAfter, addSet, buildExerciseLog, copyLastSet, createWorkout, emptySet, estimate1RM, hasAnyDoneSet, isWorkingSet, moveExercise, nextSet, previousSets, pruneUnfinished, removeSet, summarize, updateSet,
} from "./model";
import * as timer from "./timer";
import type { SetLog, WorkoutLog } from "./types";

const set = (w: number | null, r: number | null, over: Partial<SetLog> = {}): SetLog => ({ ...emptySet(), weightKg: w, reps: r, done: true, doneAt: "x", ...over });
const workout = (over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: "w", createdAt: "", updatedAt: "", schemaVersion: 1, dayKey: "2026-10-05", programId: null, sessionId: null, sessionName: "", startedAt: "2026-10-05T10:00:00.000Z",
  finishedAt: "2026-10-05T11:00:00.000Z", unit: "kg", exercises: [], notes: "", ...over,
});
const exLog = (exerciseId: string, sets: SetLog[]) => ({ ...buildExerciseLog(null, exerciseId, []), sets });

describe("previous sets", () => {
  it("returns the latest finished session's working sets", () => {
    const older = workout({ id: "a", startedAt: "2026-09-01T10:00:00Z", exercises: [exLog("sq", [set(100, 5)])] });
    const newer = workout({ id: "b", startedAt: "2026-10-01T10:00:00Z", exercises: [exLog("sq", [set(60, 5, { type: "warmup" }), set(110, 5), set(110, 4)])] });
    expect(previousSets([older, newer], "sq").map(s => s.weightKg)).toEqual([110, 110]);
  });
  it("ignores drafts, other exercises, the excluded workout and unfinished sets", () => {
    const draft = workout({ id: "d", finishedAt: null, exercises: [exLog("sq", [set(200, 1)])] });
    const other = workout({ id: "o", exercises: [exLog("bp", [set(80, 8)])] });
    const unfinished = workout({ id: "u", startedAt: "2026-10-02T10:00:00Z", exercises: [exLog("sq", [set(90, 5, { done: false })])] });
    expect(previousSets([draft, other, unfinished], "sq")).toEqual([]);
    const real = workout({ id: "r", exercises: [exLog("sq", [set(100, 5)])] });
    expect(previousSets([real], "sq", "r")).toEqual([]);
  });
});

describe("building a workout from a session", () => {
  const session: SessionTemplate = {
    id: "s", name: "Push",
    exercises: [{ id: "slot1", exerciseId: "bp", sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, notes: "pause", supersetGroup: null }],
  };
  it("creates the planned number of sets with target and rest", () => {
    const w = createWorkout({ dayKey: "2026-10-05", programId: "p", session, unit: "kg", history: [] });
    expect(w.finishedAt).toBeNull();
    expect(w.exercises[0]).toMatchObject({ exerciseId: "bp", restSec: 150, notes: "pause", target: { sets: 3, repMin: 6, repMax: 10, rir: 2 } });
    expect(w.exercises[0].sets).toHaveLength(3);
    expect(w.exercises[0].sets.every(s => !s.done && s.weightKg === null)).toBe(true);
  });
  it("prefills weight and reps from last session, reusing the last value for extra sets", () => {
    const hist = [workout({ exercises: [exLog("bp", [set(80, 8), set(80, 7)])] })];
    const w = createWorkout({ dayKey: "2026-10-12", programId: "p", session, unit: "kg", history: hist });
    expect(w.exercises[0].sets.map(s => [s.weightKg, s.reps])).toEqual([[80, 8], [80, 7], [80, 7]]);
  });
  it("a quick workout starts empty", () => {
    expect(createWorkout({ dayKey: "d", programId: null, session: null, unit: "lb", history: [] }).exercises).toEqual([]);
  });
});

describe("editing sets", () => {
  it("addSet copies the last set; removeSet removes by id", () => {
    let e = exLog("bp", [set(80, 8)]);
    e = addSet(e);
    expect(e.sets).toHaveLength(2);
    expect(e.sets[1]).toMatchObject({ weightKg: 80, reps: 8, done: false });
    e = removeSet(e, e.sets[0].id);
    expect(e.sets).toHaveLength(1);
  });
  it("addSet supports types", () => {
    expect(addSet(exLog("bp", []), "drop").sets[0].type).toBe("drop");
  });
  it("copyLastSet copies from the set above, or from the previous session for the first set", () => {
    const e = exLog("bp", [set(80, 8, { rir: 2 }), { ...emptySet() }]);
    expect(copyLastSet(e, e.sets[1].id, []).sets[1]).toMatchObject({ weightKg: 80, reps: 8, rir: 2 });
    const first = exLog("bp", [{ ...emptySet() }]);
    expect(copyLastSet(first, first.sets[0].id, [set(70, 10)]).sets[0]).toMatchObject({ weightKg: 70, reps: 10 });
    expect(copyLastSet(first, first.sets[0].id, [])).toBe(first);
  });
  it("updateSet changes only the target set", () => {
    const w = workout({ exercises: [exLog("a", [set(1, 1), set(2, 2)])] });
    const [e] = w.exercises;
    const next = updateSet(w, e.id, e.sets[1].id, s => ({ ...s, reps: 9 }));
    expect(next.exercises[0].sets.map(s => s.reps)).toEqual([1, 9]);
  });
  it("moveExercise swaps neighbours and ignores out-of-range moves", () => {
    const w = workout({ exercises: [exLog("a", []), exLog("b", []), exLog("c", [])] });
    expect(moveExercise(w, w.exercises[1].id, -1).exercises.map(e => e.exerciseId)).toEqual(["b", "a", "c"]);
    expect(moveExercise(w, w.exercises[0].id, -1)).toBe(w);
    expect(moveExercise(w, w.exercises[2].id, 1)).toBe(w);
  });
});

describe("addSetAfter", () => {
  it("inserts below the chosen set, copying weight and reps", () => {
    const e = exLog("a", [set(50, 10), set(60, 8)]);
    const next = addSetAfter(e, e.sets[0].id);
    expect(next.sets.map(s => s.weightKg)).toEqual([50, 50, 60]);
    expect(next.sets[1]).toMatchObject({ reps: 10, done: false });
    expect(addSetAfter(e, "missing")).toBe(e);
  });
});

describe("summary", () => {
  it("counts only finished non-warm-up sets and weights muscles", async () => {
    const all = await loadBundled();
    const bench = all.find(e => e.name.en === "Barbell Bench Press - Medium Grip")!;
    const w = workout({ exercises: [exLog(bench.id, [set(60, 10, { type: "warmup" }), set(100, 5), set(100, 5), set(100, 5, { done: false })])] });
    const s = summarize(w, id => all.find(e => e.id === id));
    expect(s.workingSets).toBe(2);
    expect(s.volumeKg).toBe(1000);
    expect(s.muscleSets.chest).toBe(2);
    expect(s.muscleSets.triceps).toBe(1); // secondary counts half
    expect(s.durationSec).toBe(3600);
  });
  it("bodyweight sets add zero volume but count as sets", () => {
    const w = workout({ exercises: [exLog("x", [set(null, 12)])] });
    const s = summarize(w, () => undefined);
    expect(s.workingSets).toBe(1);
    expect(s.volumeKg).toBe(0);
  });
  it("isWorkingSet rejects blank reps and warm-ups", () => {
    expect(isWorkingSet(set(10, null))).toBe(false);
    expect(isWorkingSet(set(10, 0))).toBe(false);
    expect(isWorkingSet(set(10, 5, { type: "warmup" }))).toBe(false);
    expect(isWorkingSet(set(10, 5, { type: "failure" }))).toBe(true);
  });
});

describe("pruning and progress helpers", () => {
  it("removes unfinished sets and empty exercises", () => {
    const w = workout({ exercises: [exLog("a", [set(1, 1), set(1, 1, { done: false })]), exLog("b", [set(1, 1, { done: false })])] });
    const p = pruneUnfinished(w);
    expect(p.exercises).toHaveLength(1);
    expect(p.exercises[0].sets).toHaveLength(1);
  });
  it("hasAnyDoneSet and nextSet", () => {
    const w = workout({ exercises: [exLog("a", [set(1, 1), set(1, 1, { done: false })])] });
    expect(hasAnyDoneSet(w)).toBe(true);
    expect(nextSet(w)).toMatchObject({ exerciseId: w.exercises[0].id, setId: w.exercises[0].sets[1].id });
    expect(nextSet(workout())).toBeNull();
  });
  it("estimate1RM uses Epley with RIR as extra reps", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimate1RM(100, 5, 2)).toBeCloseTo(123.33, 1);
  });
});

describe("rest timer", () => {
  const T0 = 1_000_000;
  it("counts down from timestamps, independent of how often it is polled", () => {
    const s = timer.start(T0, 90);
    expect(timer.remainingSec(s, T0)).toBe(90);
    expect(timer.remainingSec(s, T0 + 30_000)).toBe(60);
    expect(timer.remainingSec(s, T0 + 5 * 60_000)).toBe(0); // e.g. phone was locked for 5 minutes
  });
  it("pauses and resumes without drift", () => {
    const s = timer.start(T0, 90);
    const p = timer.pause(s, T0 + 20_000);
    expect(timer.isPaused(p)).toBe(true);
    expect(timer.remainingSec(p, T0 + 999_999)).toBe(70);
    const r = timer.resume(p, T0 + 100_000);
    expect(timer.remainingSec(r, T0 + 100_000)).toBe(70);
    expect(timer.remainingSec(r, T0 + 110_000)).toBe(60);
  });
  it("adjusts by 15 s, growing the bar total and never going negative", () => {
    let s = timer.start(T0, 90);
    s = timer.adjust(s, T0, 15);
    expect(timer.remainingSec(s, T0)).toBe(105);
    expect(s.totalSec).toBe(105);
    s = timer.adjust(s, T0, -15);
    expect(timer.remainingSec(s, T0)).toBe(90);
    s = timer.adjust(s, T0 + 80_000, -15);
    expect(timer.remainingSec(s, T0 + 80_000)).toBe(0);
    expect(timer.adjust(timer.idle, T0, 15)).toBe(timer.idle);
  });
  it("adjusts while paused", () => {
    const p = timer.pause(timer.start(T0, 60), T0 + 10_000);
    expect(timer.remainingSec(timer.adjust(p, T0 + 50_000, 15), T0 + 90_000)).toBe(65);
  });
  it("alerts exactly once when the time is up", () => {
    let s = timer.start(T0, 10);
    expect(timer.shouldAlert(s, T0 + 9_999)).toBe(false);
    expect(timer.shouldAlert(s, T0 + 10_000)).toBe(true);
    s = timer.markAlerted(s);
    expect(timer.shouldAlert(s, T0 + 20_000)).toBe(false);
  });
  it("adding time after the alert re-arms it", () => {
    let s = timer.markAlerted(timer.start(T0, 10));
    s = timer.adjust(s, T0 + 9_000, 15);
    expect(s.alerted).toBe(false);
  });
  it("progress goes 0..1", () => {
    const s = timer.start(T0, 100);
    expect(timer.progress(s, T0)).toBe(0);
    expect(timer.progress(s, T0 + 50_000)).toBe(0.5);
    expect(timer.progress(s, T0 + 500_000)).toBe(1);
    expect(timer.progress(timer.idle, T0)).toBe(0);
  });
  it("skip returns to idle", () => {
    expect(timer.isActive(timer.skip())).toBe(false);
  });
  it("keeps the last 5 custom times, most recent first, de-duplicated", () => {
    let list: number[] = [];
    for (const n of [60, 75, 100, 135, 200, 240]) list = timer.pushRecent(list, n);
    expect(list).toEqual([240, 200, 135, 100, 75]);
    expect(timer.pushRecent(list, 100)).toEqual([100, 240, 200, 135, 75]);
    expect(timer.removeRecent(list, 200)).toEqual([240, 135, 100, 75]);
  });
  it("parses durations", () => {
    expect(timer.parseDuration("1:30")).toBe(90);
    expect(timer.parseDuration("90")).toBe(90);
    expect(timer.parseDuration("2m")).toBe(120);
    expect(timer.parseDuration("1m30")).toBe(90);
    expect(timer.parseDuration("0:03")).toBeNull();
    expect(timer.parseDuration("abc")).toBeNull();
    expect(timer.parseDuration("99:00")).toBeNull();
  });
});
