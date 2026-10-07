import { beforeAll, describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { BENCH, SQUAT, workout } from "../coach/fixtures";
import {
  dailySets, exerciseSeries, goalProgress, landmarksFor, loggedExercises, prTimeline, rangeStart, sessionDurations, slopePerDay, smoothWeights, weekStreak, weeklyMuscleSets, weeklyTotals,
} from "./stats";
import type { BodyMetricRecord, GoalRecord } from "./types";

let all: Exercise[];
const lookup = (id: string) => all.find(e => e.id === id);
beforeAll(async () => { all = await loadBundled(); });

const x3 = (w: number, r: number): [number, number][] => [[w, r], [w, r], [w, r]];
const goal = (g: Partial<GoalRecord>): GoalRecord => ({ id: "g", createdAt: "", updatedAt: "", schemaVersion: 1, kind: "lift", ...g });
const bm = (dayKey: string, weightKg: number): BodyMetricRecord => ({ id: "bm" + dayKey, createdAt: "", updatedAt: "", schemaVersion: 1, dayKey, weightKg });

describe("ranges", () => {
  it("computes the first included day for each range", () => {
    expect(rangeStart("week", "2026-10-07")).toBe("2026-10-05");
    expect(rangeStart("month", "2026-10-07")).toBe("2026-09-08");
    expect(rangeStart("3months", "2026-10-07")).toBe("2026-07-09");
    expect(rangeStart("year", "2026-10-07")).toBe("2025-10-08");
    expect(rangeStart("all", "2026-10-07")).toBeNull();
  });
});

describe("exercise series", () => {
  it("one point per session with best e1RM and heaviest set", () => {
    const ws = [workout("2026-10-01", [{ ex: BENCH, sets: [[80, 8], [85, 5], [70, 12]] }]), workout("2026-10-08", [{ ex: BENCH, sets: x3(82.5, 8) }])];
    const s = exerciseSeries(ws, BENCH);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ dayKey: "2026-10-01", topKg: 85, topReps: 5, sets: 3 });
    expect(s[0].e1rm).toBeCloseTo(Math.max(80 * (1 + 8 / 30), 85 * (1 + 5 / 30), 70 * (1 + 12 / 30)), 5);
    expect(s[1].e1rm).toBeGreaterThan(s[0].e1rm);
  });
  it("skips drafts and bodyweight-only sessions", () => {
    const ws = [workout("2026-10-01", [{ ex: BENCH, sets: x3(80, 8) }], { finishedAt: null }), workout("2026-10-02", [{ ex: "Pullups", sets: [[null, 10]] }])];
    expect(exerciseSeries(ws, BENCH)).toEqual([]);
    expect(exerciseSeries(ws, "Pullups")).toEqual([]);
  });
  it("lists logged exercises by frequency", () => {
    const ws = [workout("2026-10-01", [{ ex: BENCH, sets: x3(80, 8) }, { ex: SQUAT, sets: x3(100, 5) }]), workout("2026-10-03", [{ ex: SQUAT, sets: x3(100, 5) }])];
    expect(loggedExercises(ws).map(x => x.exerciseId)).toEqual([SQUAT, BENCH]);
  });
});

describe("weekly totals and muscles", () => {
  it("includes empty weeks so gaps are visible", () => {
    const ws = [workout("2026-09-14", [{ ex: BENCH, sets: x3(100, 5) }]), workout("2026-10-05", [{ ex: BENCH, sets: x3(100, 5) }])];
    const weeks = weeklyTotals(ws, "2026-09-14", "2026-10-07", lookup);
    expect(weeks.map(w => w.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(weeks.map(w => w.volumeKg)).toEqual([1500, 0, 0, 1500]);
    expect(weeks[0]).toMatchObject({ sets: 3, sessions: 1 });
  });
  it("counts muscle sets like the coach (secondary at half)", () => {
    const ws = [workout("2026-10-05", [{ ex: BENCH, sets: x3(100, 5) }])];
    const [w] = weeklyMuscleSets(ws, "2026-10-05", "2026-10-07", lookup);
    expect(w.sets.chest).toBe(3);
    expect(w.sets.triceps).toBe(1.5);
  });
  it("landmarks follow the profile", () => {
    expect(landmarksFor("advanced", "muscle", "bulk")("chest").mrv).toBeGreaterThan(landmarksFor("beginner", "muscle", "cut")("chest").mrv);
  });
});

describe("calendar, streak, durations, PRs", () => {
  const ws = [
    workout("2026-09-21", [{ ex: BENCH, sets: x3(80, 8) }]),
    workout("2026-09-28", [{ ex: BENCH, sets: x3(82.5, 8) }]),
    workout("2026-10-05", [{ ex: BENCH, sets: x3(85, 8) }], { startedAt: "2026-10-05T10:00:00.000Z", finishedAt: "2026-10-05T11:05:00.000Z" }),
  ];
  it("daily sets", () => { expect(dailySets(ws).get("2026-10-05")).toBe(3); });
  it("week streak counts back from this week (or last week if this one is empty)", () => {
    expect(weekStreak(ws, "2026-10-07")).toBe(3);
    expect(weekStreak(ws, "2026-10-12")).toBe(3); // this week has nothing yet: streak still alive
    expect(weekStreak(ws, "2026-10-20")).toBe(0);
    expect(weekStreak(ws, "2026-10-07", 2)).toBe(0);
  });
  it("session durations in minutes", () => {
    expect(sessionDurations(ws, "2026-10-01", "2026-10-07")).toEqual([{ dayKey: "2026-10-05", minutes: 65, name: "" }]);
  });
  it("PR timeline newest first, filtered by range", () => {
    const t = prTimeline(ws, null, "2026-10-07");
    expect(t[0].dayKey).toBe("2026-10-05");
    expect(t.every(p => p.dayKey >= "2026-09-28")).toBe(true); // the first session is a baseline
    expect(prTimeline(ws, "2026-10-01", "2026-10-07").every(p => p.dayKey === "2026-10-05")).toBe(true);
  });
});

describe("body weight and goals", () => {
  it("smooths weights with a 7-entry EMA", () => {
    const s = smoothWeights([{ dayKey: "2026-10-01", kg: 80 }, { dayKey: "2026-10-02", kg: 82 }]);
    expect(s[0].kg).toBe(80);
    expect(s[1].kg).toBeCloseTo(80.5, 5);
  });
  it("slope per day by least squares", () => {
    expect(slopePerDay([{ dayKey: "2026-10-01", v: 100 }, { dayKey: "2026-10-11", v: 101 }, { dayKey: "2026-10-21", v: 102 }])).toBeCloseTo(0.1, 5);
    expect(slopePerDay([{ dayKey: "2026-10-01", v: 1 }])).toBeNull();
  });
  it("lift goal: progress, projection and achievement", () => {
    const ws = ["2026-09-01", "2026-09-15", "2026-09-29"].map((d, i) => workout(d, [{ ex: BENCH, sets: x3(80 + i * 2.5, 5) }]));
    const g = goalProgress(goal({ exerciseId: BENCH, targetKg: 110 }), ws, [], "2026-10-01");
    expect(g.current).toBeCloseTo(85 * (1 + 5 / 30), 3);
    expect(g.fraction).toBeGreaterThan(0.85);
    expect(g.achieved).toBe(false);
    expect(g.projected).not.toBeNull();
    expect(g.projected! > "2026-10-01").toBe(true);
    expect(goalProgress(goal({ exerciseId: BENCH, targetKg: 90 }), ws, [], "2026-10-01").achieved).toBe(true);
  });
  it("no projection when trending away from the target", () => {
    const ws = ["2026-09-01", "2026-09-15", "2026-09-29"].map((d, i) => workout(d, [{ ex: BENCH, sets: x3(85 - i * 2.5, 5) }]));
    expect(goalProgress(goal({ exerciseId: BENCH, targetKg: 120 }), ws, [], "2026-10-01").projected).toBeNull();
  });
  it("body-weight goal works for losing and gaining", () => {
    const down = [80, 79.5, 79, 78.5, 78].map((kg, i) => bm(`2026-09-${String(10 + i * 4).padStart(2, "0")}`, kg));
    const lose = goalProgress(goal({ kind: "bodyweight", targetKg: 75, startKg: 80 }), [], down, "2026-10-01");
    expect(lose.fraction).toBeGreaterThan(0);
    expect(lose.fraction).toBeLessThan(1);
    expect(lose.projected).not.toBeNull();
    const gain = goalProgress(goal({ kind: "bodyweight", targetKg: 85, startKg: 80 }), [], down, "2026-10-01");
    expect(gain.fraction).toBe(0);
    expect(gain.projected).toBeNull();
  });
  it("sessions goal counts this week's sessions", () => {
    const ws = [workout("2026-10-05", [{ ex: BENCH, sets: x3(80, 8) }]), workout("2026-10-06", [{ ex: BENCH, sets: x3(80, 8) }])];
    expect(goalProgress(goal({ kind: "sessions", perWeek: 3 }), ws, [], "2026-10-07")).toMatchObject({ current: 2, achieved: false });
    expect(goalProgress(goal({ kind: "sessions", perWeek: 2 }), ws, [], "2026-10-07").achieved).toBe(true);
  });
});
