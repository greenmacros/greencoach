import { describe, expect, it } from "vitest";
import { buildExerciseLog, emptySet } from "./model";
import { applySet, bestsFrom, checkSet, computeAllPRs, emptyBests, livePRs, topPR } from "./pr";
import type { SetLog, WorkoutLog } from "./types";

const set = (w: number | null, r: number, over: Partial<SetLog> = {}): SetLog => ({ ...emptySet(), weightKg: w, reps: r, done: true, doneAt: "x", ...over });
let n = 0;
const wk = (day: number, ex: string, sets: SetLog[], over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: "w" + n++, createdAt: "", updatedAt: "", schemaVersion: 1, dayKey: "", programId: null, sessionId: null, sessionName: "",
  startedAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`, finishedAt: `2026-10-${String(day).padStart(2, "0")}T11:00:00Z`, unit: "kg",
  exercises: [{ ...buildExerciseLog(null, ex, []), sets }], notes: "", ...over,
});
const kinds = (prs: { kind: string }[]) => prs.map(p => p.kind).sort();

describe("checkSet", () => {
  it("the first time ever is a baseline, never a PR", () => {
    expect(checkSet(emptyBests(), set(100, 5))).toEqual([]);
  });

  it("detects weight, e1RM and volume PRs for a heavier set", () => {
    const b = emptyBests(); applySet(b, set(100, 5));
    expect(kinds(checkSet(b, set(105, 5)))).toEqual(["e1rm", "volume", "weight"]);
  });

  it("detects a rep PR at the same weight", () => {
    const b = emptyBests(); applySet(b, set(100, 5));
    const hits = checkSet(b, set(100, 6));
    expect(kinds(hits)).toContain("reps");
    expect(hits.find(h => h.kind === "reps")).toMatchObject({ value: 6, previous: 5 });
    expect(kinds(hits)).not.toContain("weight");
  });

  it("matching a record is not a PR", () => {
    const b = emptyBests(); applySet(b, set(100, 5));
    expect(checkSet(b, set(100, 5))).toEqual([]);
  });

  it("a lighter set with more reps can still be an e1RM PR", () => {
    const b = emptyBests(); applySet(b, set(100, 5)); // e1RM 116.7
    expect(kinds(checkSet(b, set(90, 10)))).toEqual(["e1rm", "volume"]); // 120, 900 > 500
  });

  it("ignores warm-ups, unfinished sets and blank reps", () => {
    const b = emptyBests(); applySet(b, set(100, 5));
    expect(checkSet(b, set(200, 5, { type: "warmup" }))).toEqual([]);
    expect(checkSet(b, set(200, 5, { done: false }))).toEqual([]);
    const blank = { ...set(200, 1), reps: null };
    expect(checkSet(b, blank)).toEqual([]);
    applySet(b, set(500, 5, { type: "warmup" }));
    expect(b.weight).toBe(100);
  });

  it("bodyweight exercises only get rep PRs", () => {
    const b = emptyBests(); applySet(b, set(null, 10));
    expect(kinds(checkSet(b, set(null, 11)))).toEqual(["reps"]);
    expect(checkSet(b, set(null, 10))).toEqual([]);
  });

  it("a new load with no history at that exact weight does not claim a rep PR", () => {
    const b = emptyBests(); applySet(b, set(100, 5));
    expect(kinds(checkSet(b, set(60, 3)))).toEqual([]);
  });
});

describe("computeAllPRs", () => {
  it("judges each workout against earlier ones only, in date order", () => {
    const a = wk(1, "sq", [set(100, 5)]);
    const b = wk(8, "sq", [set(105, 5)]);
    const c = wk(15, "sq", [set(102.5, 5)]);
    const prs = computeAllPRs([c, a, b]); // order must not matter
    expect(prs.get(a.id)).toEqual([]);
    expect(kinds(prs.get(b.id)!)).toEqual(["e1rm", "volume", "weight"]);
    expect(prs.get(c.id)).toEqual([]); // below the 105 record
  });

  it("within one session only the first set to break a record is credited", () => {
    const a = wk(1, "sq", [set(100, 5)]);
    const b = wk(8, "sq", [set(105, 5), set(105, 5), set(110, 3)]);
    const hits = computeAllPRs([a, b]).get(b.id)!;
    expect(hits.filter(h => h.kind === "weight").map(h => h.value)).toEqual([105, 110]);
    expect(hits.filter(h => h.kind === "weight")).toHaveLength(2);
  });

  it("tracks exercises independently and skips drafts", () => {
    const a = wk(1, "sq", [set(100, 5)]);
    const bp = wk(2, "bp", [set(80, 5)]);
    const draft = wk(3, "sq", [set(200, 5)], { finishedAt: null });
    const prs = computeAllPRs([a, bp, draft]);
    expect(prs.get(bp.id)).toEqual([]);
    expect(prs.has(draft.id)).toBe(false);
  });
});

describe("live PR check", () => {
  it("compares with history and earlier sets of the same workout", () => {
    const hist = [wk(1, "sq", [set(100, 5)])];
    const cur = wk(8, "sq", [set(105, 5), set(105, 5)], { finishedAt: null });
    const [e] = cur.exercises;
    expect(kinds(livePRs(hist, cur, e.id, e.sets[0].id))).toContain("weight");
    expect(livePRs(hist, cur, e.id, e.sets[1].id)).toEqual([]); // 105 already set by set 1
  });
  it("no history means no PR", () => {
    const cur = wk(8, "sq", [set(105, 5)], { finishedAt: null });
    expect(livePRs([], cur, cur.exercises[0].id, cur.exercises[0].sets[0].id)).toEqual([]);
  });
  it("bestsFrom excludes the given workout and drafts", () => {
    const a = wk(1, "sq", [set(100, 5)]);
    const draft = wk(2, "sq", [set(300, 5)], { finishedAt: null });
    expect(bestsFrom([a, draft], "sq").weight).toBe(100);
    expect(bestsFrom([a], "sq", a.id).seen).toBe(false);
  });
  it("topPR prefers weight over e1rm over reps over volume", () => {
    const base = { workoutId: "w", exerciseId: "e", setId: "s", value: 1, previous: 0 };
    expect(topPR([{ ...base, kind: "volume" }, { ...base, kind: "e1rm" }])!.kind).toBe("e1rm");
    expect(topPR([])).toBeUndefined();
  });
});
