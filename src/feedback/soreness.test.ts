import { describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import { buildExerciseLog, emptySet } from "../workout/model";
import type { WorkoutLog } from "../workout/types";
import { sorenessId, sorenessQuestions } from "./soreness";

const wk = (id: string, dayKey: string, exerciseIds: string[], over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id, createdAt: "", updatedAt: "", schemaVersion: 1, dayKey, programId: null, sessionId: null, sessionName: "",
  startedAt: dayKey + "T10:00:00Z", finishedAt: dayKey + "T11:00:00Z", unit: "kg", notes: "",
  exercises: exerciseIds.map(x => ({ ...buildExerciseLog(null, x, []), sets: [{ ...emptySet(), weightKg: 50, reps: 8, done: true }] })), ...over,
});

describe("soreness questions", () => {
  it("asks about muscles trained today that were trained recently, once per muscle", async () => {
    const all = await loadBundled();
    const id = (n: string) => all.find(e => e.name.en === n)!.id;
    const lookup = (x: string) => all.find(e => e.id === x);
    const prevChest = wk("a", "2026-10-01", [id("Barbell Bench Press - Medium Grip")]);
    const prevLegs = wk("b", "2026-10-03", [id("Barbell Squat")]);
    const today = wk("c", "2026-10-05", [id("Dumbbell Bench Press"), id("Incline Dumbbell Press")], { finishedAt: null });
    const q = sorenessQuestions(today, [prevChest, prevLegs], lookup);
    expect(q).toEqual([{ muscle: "chest", prevWorkoutId: "a", daysAgo: 4 }]);
  });

  it("skips muscles never trained, trained today, or trained over two weeks ago; ignores drafts", async () => {
    const all = await loadBundled();
    const id = (n: string) => all.find(e => e.name.en === n)!.id;
    const lookup = (x: string) => all.find(e => e.id === x);
    const squat = id("Barbell Squat");
    const today = wk("t", "2026-10-20", [squat], { finishedAt: null });
    expect(sorenessQuestions(today, [], lookup)).toEqual([]);
    expect(sorenessQuestions(today, [wk("old", "2026-10-01", [squat])], lookup)).toEqual([]); // 19 days
    expect(sorenessQuestions(today, [wk("same", "2026-10-20", [squat])], lookup)).toEqual([]);
    expect(sorenessQuestions(today, [wk("dr", "2026-10-18", [squat], { finishedAt: null })], lookup)).toEqual([]);
    const ok = sorenessQuestions(today, [wk("ok", "2026-10-18", [squat])], lookup);
    expect(ok.map(x => x.muscle)).toEqual(["quadriceps"]);
  });

  it("uses the most recent session that trained the muscle", async () => {
    const all = await loadBundled();
    const squat = all.find(e => e.name.en === "Barbell Squat")!.id;
    const lookup = (x: string) => all.find(e => e.id === x);
    const q = sorenessQuestions(wk("t", "2026-10-10", [squat], { finishedAt: null }), [wk("a", "2026-10-02", [squat]), wk("b", "2026-10-07", [squat])], lookup);
    expect(q[0]).toMatchObject({ prevWorkoutId: "b", daysAgo: 3 });
  });

  it("builds stable record ids", () => {
    expect(sorenessId("w1", "chest")).toBe("sore:w1:chest");
  });
});
