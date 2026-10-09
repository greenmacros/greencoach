import { describe, expect, it } from "vitest";
import { addDays } from "../program/schedule";
import { COACH_CONFIG } from "./config";
import { dropSuggestions } from "./engine";
import { BENCH, CURL, program, session, week, workout } from "./fixtures";
import { skipExercise } from "../workout/model";
import type { WorkoutLog } from "../workout/types";

const prog = program([session("Upper", [{ ex: BENCH, sets: 3, lo: 6, hi: 10 }, { ex: CURL, sets: 2, lo: 10, hi: 15 }])], [0, null, null, null, null, null, null]);
const [benchSlot, curlSlot] = prog.sessions[0].exercises;

/** A finished Upper session where curls are skipped (as a whole, with a reason), done, or left out entirely. */
function upper(day: string, curl: "skip" | "done" | "removed"): WorkoutLog {
  const w = workout(day, [{ ex: BENCH, sets: [[80, 8, 2]] }, { ex: CURL, sets: [[12, 12, 2]] }]);
  w.sessionId = prog.sessions[0].id;
  w.exercises[0].slotId = benchSlot.id;
  w.exercises[1].slotId = curlSlot.id;
  if (curl === "skip") w.exercises[1] = skipExercise({ ...w.exercises[1], sets: w.exercises[1].sets.map(s => ({ ...s, done: false })) }, "time");
  if (curl === "removed") w.exercises = [w.exercises[0]];
  return w;
}
const days = [0, 1, 2, 3].map(i => addDays(week(1), i * 7));

describe("exercises the user keeps skipping", () => {
  it("asks after 3 of the last 4 sessions, with the most common reason", () => {
    const ws = [upper(days[0], "skip"), upper(days[1], "done"), upper(days[2], "skip"), upper(days[3], "removed")];
    const d = dropSuggestions(prog, ws, {}, days[3], COACH_CONFIG);
    expect(d).toEqual([{ sessionId: prog.sessions[0].id, slotId: curlSlot.id, exerciseId: CURL, skipped: 3, of: 4, topReason: "time" }]);
  });

  it("does not ask for fewer skips, for optional exercises, or soon after the user chose to keep it", () => {
    const two = [upper(days[0], "skip"), upper(days[1], "done"), upper(days[2], "done"), upper(days[3], "skip")];
    expect(dropSuggestions(prog, two, {}, days[3], COACH_CONFIG)).toEqual([]);
    const three = [upper(days[0], "skip"), upper(days[1], "skip"), upper(days[2], "skip")];
    const opt = { ...prog, sessions: [{ ...prog.sessions[0], exercises: [benchSlot, { ...curlSlot, optional: true }] }] };
    expect(dropSuggestions(opt, three, {}, days[2], COACH_CONFIG)).toEqual([]);
    expect(dropSuggestions(prog, three, { [curlSlot.id]: days[2] }, addDays(days[2], 7), COACH_CONFIG)).toEqual([]);
    expect(dropSuggestions(prog, three, { [curlSlot.id]: days[2] }, addDays(days[2], 30), COACH_CONFIG)).toHaveLength(1); // asked again later
  });

  it("skipping for pain records joint pain, so the coach holds it and suggests alternatives", () => {
    const w = upper(days[0], "done");
    const e = skipExercise(w.exercises[1], "pain");
    expect(e.jointPain).toBe(2);
    expect(e.skip).toEqual({ reason: "pain" });
  });
});
