import { beforeAll, describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { addDays } from "../program/schedule";
import { COACH_CONFIG } from "./config";
import { increment } from "./load";
import { bodyWeightRate, plannedSessionCount, plannedSoFar } from "./stats";
import { disruptionsIn, seasonFor } from "./seasons";
import {
  BANDROW, BENCH, CALF, CURL, INCLINE, LEGCURL, PULLUP, PUSHDOWN, ROW, SQUAT, START,
  history, muscleFor, profile, program, run, session, slotFor, soreRecord, standardProgram, week, workout, type LogSpec,
} from "./fixtures";

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });

const bench = (sets: LogSpec["sets"], extra: Partial<LogSpec> = {}): LogSpec => ({ ex: BENCH, sets, target: { repMin: 6, repMax: 10, rir: 2 }, ...extra });
const x3 = (w: number | null, r: number, rir?: number): LogSpec["sets"] => [rir === undefined ? [w, r] : [w, r, rir], rir === undefined ? [w, r] : [w, r, rir], rir === undefined ? [w, r] : [w, r, rir]];
const nextBench = (spec: LogSpec, over: Parameters<typeof run>[1] = {}) => slotFor(run(all, { workouts: history([spec]), ...over }), BENCH);

/* ------------------------------------------------------------------ modes */
describe("plan modes", () => {
  it("first week: no data -> start near MEV, weights left to the user, RIR 3", () => {
    const p = run(all);
    expect(p.mode).toBe("first");
    expect(p.newMeso).toBe(true);
    expect(p.targetRir).toBe(3);
    expect(slotFor(p, BENCH).next.weightKg).toBeNull();
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.first");
    expect(muscleFor(p, "chest").reason.key).toBe("why.vol.first"); // 6 sets < starting volume: raised
    expect(muscleFor(p, "chest").newSets).toBeGreaterThan(6);
    expect(p.notes.some(n => n.reason.key === "why.note.first")).toBe(true);
  });

  it("first week keeps a program's volume when it is already productive, and trims only clear excess", () => {
    const prog = program([
      session("A", [{ ex: SQUAT, sets: 4, lo: 5, hi: 8 }, { ex: "Leg_Press", sets: 4, lo: 8, hi: 12 }]),
      session("B", [{ ex: "Hack_Squat", sets: 4, lo: 6, hi: 10 }, { ex: "Leg_Extensions", sets: 4, lo: 10, hi: 15 }]),
    ], [0, null, null, 1, null, null, null]);
    const quads = muscleFor(run(all, { program: prog }), "quadriceps"); // 16 direct sets: inside MEV..MAV
    expect(quads.reason.key).toBe("why.vol.firstKeep");
    expect(quads.delta).toBe(0);
    const huge = program([session("A", [{ ex: SQUAT, sets: 6, lo: 5, hi: 8 }, { ex: "Leg_Press", sets: 6, lo: 8, hi: 12 }]), session("B", [{ ex: "Hack_Squat", sets: 6, lo: 6, hi: 10 }, { ex: "Leg_Extensions", sets: 6, lo: 10, hi: 15 }])], [0, null, null, 1, null, null, null]);
    const q2 = muscleFor(run(all, { program: huge }), "quadriceps");
    expect(q2.reason.key).toBe("why.vol.firstCap");
    expect(q2.newSets).toBeLessThan(q2.lastSets);
  });

  it("empty program produces a note and no suggestions", () => {
    const p = run(all, { program: program([], [null, null, null, null, null, null, null]) });
    expect(p.slots).toEqual([]);
    expect(p.notes.some(n => n.reason.key === "why.note.emptyProgram")).toBe(true);
  });

  it("scheduled deload: half the sets, RIR 5, lighter weights", () => {
    const w5 = [workout(week(5), [bench(x3(80, 8, 1))]), workout(addDays(week(5), 3), [{ ex: SQUAT, sets: x3(100, 6, 1) }])];
    const p = run(all, { today: addDays(week(5), 6), targetWeekStart: week(6), workouts: w5 });
    expect(p.mode).toBe("deload");
    expect(p.deload.type).toBe("scheduled");
    expect(p.targetRir).toBe(5);
    expect(slotFor(p, BENCH).next.sets).toBe(2);
    expect(slotFor(p, BENCH).next.weightKg).toBeCloseTo(72.5, 1); // 80 * 0.9 rounded to loadable
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.deload");
    expect(muscleFor(p, "chest").newSets).toBeLessThanOrEqual(muscleFor(p, "chest").lastSets * 0.75);
    expect(muscleFor(p, "chest").reason.key).toBe("why.vol.deload");
  });

  it("early deload when 2+ muscles regress across their last two sessions", () => {
    const up = (w: number): LogSpec[] => [bench(x3(w, 8, 2))];
    const lo = (w: number): LogSpec[] => [{ ex: SQUAT, sets: x3(w, 6, 2) }];
    const ws = [
      workout(week(1), up(80)), workout(addDays(week(1), 3), lo(100)),
      workout(week(2), up(76)), workout(addDays(week(2), 3), lo(94)),
      workout(week(3), up(72)), workout(addDays(week(3), 3), lo(88)),
    ];
    const p = run(all, { today: addDays(week(3), 6), targetWeekStart: week(4), workouts: ws });
    expect(p.mode).toBe("deload");
    expect(p.deload.type).toBe("early");
    expect(p.deload.reasons[0].key).toBe("why.deload.early.perf");
    expect(p.notes.some(n => n.reason.key === "why.note.deloadEarly")).toBe(true);
  });

  it("early deload on accumulated session fatigue", () => {
    const f = (d: string, ex: string, w: number) => workout(d, [{ ex, sets: x3(w, 8, 2) }], { sessionFatigue: 5 });
    const ws = [f(week(2), BENCH, 80), f(addDays(week(2), 3), SQUAT, 100), f(week(3), BENCH, 80), f(addDays(week(3), 3), SQUAT, 100)];
    const p = run(all, { today: addDays(week(3), 6), targetWeekStart: week(4), workouts: ws });
    expect(p.deload.type).toBe("early");
    expect(p.deload.reasons.some(r => r.key === "why.deload.early.fatigue")).toBe(true);
  });

  it("early deload when soreness and difficulty are both high", () => {
    const ws = [0, 1, 2, 3].map(i => workout(addDays(week(3), i), [bench(x3(80, 8, 2), { difficulty: 5 })]));
    const sore = ws.slice(0, 3).map(w => soreRecord(w.id, "chest", 3));
    const p = run(all, { today: addDays(week(3), 6), targetWeekStart: week(4), workouts: ws, soreness: sore });
    expect(p.deload.reasons.some(r => r.key === "why.deload.early.sore")).toBe(true);
  });

  it("does not call an early deload before the minimum mesocycle week", () => {
    const ws = [0, 1, 2].map(i => workout(addDays(week(1), i), [bench(x3(80, 8, 2))], { sessionFatigue: 5 }));
    const p = run(all, { today: addDays(week(1), 6), targetWeekStart: week(2), workouts: ws });
    expect(p.mode).not.toBe("deload");
  });

  it("a 10-day break gives a welcome-back week with a 5-10% load reduction", () => {
    const p = run(all, { today: "2026-10-25", targetWeekStart: week(4), workouts: history([bench(x3(80, 8, 2))]) });
    expect(p.mode).toBe("welcome-back");
    expect(slotFor(p, BENCH).next.weightKg!).toBeGreaterThan(72);
    expect(slotFor(p, BENCH).next.weightKg!).toBeLessThan(77); // bench was last done 13 days ago: about -7%
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.welcome");
    expect(p.notes.some(n => n.reason.key === "why.note.welcome")).toBe(true);
  });

  it("a 3+ week break resets to a ramp-in week: lighter, RIR 4, lower volume", () => {
    const p = run(all, { today: "2026-11-08", targetWeekStart: week(6), workouts: history([bench(x3(80, 8, 2))]) });
    expect(p.mode).toBe("ramp");
    expect(p.targetRir).toBe(4);
    expect(slotFor(p, BENCH).next.weightKg).toBeCloseTo(70, 0);
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.ramp");
    expect(muscleFor(p, "chest").reason.key).toBe("why.vol.ramp");
    expect(muscleFor(p, "chest").newSets).toBeLessThanOrEqual(muscleFor(p, "chest").lastSets);
  });

  it("after a deload the next mesocycle restarts volume near MEV, not from the deload volume", () => {
    const peak = [workout(week(5), [bench(x3(80, 9, 1))]), workout(addDays(week(5), 3), [{ ex: SQUAT, sets: x3(100, 6, 1) }])];
    const deload = [workout(week(6), [bench(x3(72, 9, 5))], { mesoWeek: 6 })];
    const p = run(all, { today: addDays(week(6), 6), targetWeekStart: week(7), workouts: [...peak, ...deload] });
    expect(p.newMeso).toBe(true);
    expect(p.meso.week).toBe(1);
    expect(p.targetRir).toBe(3);
    expect(muscleFor(p, "chest").reason.key).toBe("why.vol.start");
  });

  it("deload-week sessions never drive load decisions", () => {
    const peak = workout(week(5), [bench(x3(80, 10, 2))]);
    const deload = workout(week(6), [bench(x3(72, 10, 5))], { mesoWeek: 6 });
    const p = run(all, { today: addDays(week(6), 6), targetWeekStart: week(7), workouts: [peak, deload] });
    expect(slotFor(p, BENCH).next.weightKg).toBeCloseTo(82.5, 1); // progressed from the 80 kg session, not the 72 kg deload
  });
});

/* -------------------------------------------------------- load progression */
describe("load progression", () => {
  it("top of the range at the target RIR -> smallest barbell jump, reps reset to the bottom", () => {
    const s = nextBench(bench(x3(80, 10, 2)));
    expect(s.next.weightKg).toBe(82.5);
    expect(s.next.targetReps).toBe(6);
    expect(s.trend.weight).toBe("up");
    expect(s.reason.key).toBe("why.load.up");
  });

  it("dumbbell steps are 1 kg when light and 2 kg when heavier", () => {
    const mk = (w: number) => slotFor(run(all, { workouts: [workout(week(2), [{ ex: CURL, sets: x3(w, 15, 2), target: { repMin: 10, repMax: 15, rir: 2 } }]), workout(addDays(week(2), 3), [{ ex: SQUAT, sets: x3(100, 6, 2) }])] }), CURL);
    expect(mk(10).next.weightKg).toBe(11);
    expect(mk(14).next.weightKg).toBe(16);
  });

  it("heavy lower-body barbell lifts jump 5 kg", () => {
    const p = run(all, { workouts: history([bench(x3(80, 8, 2))], { lower: [{ ex: SQUAT, sets: x3(100, 8, 2), target: { repMin: 5, repMax: 8, rir: 2 } }] }) });
    expect(slotFor(p, SQUAT).next.weightKg).toBe(105);
  });

  it("cable and machine lifts jump 2.5 kg", () => {
    const p = run(all, { workouts: history([{ ex: ROW, sets: x3(50, 12, 2), target: { repMin: 8, repMax: 12, rir: 2 } }], { lower: [{ ex: LEGCURL, sets: x3(40, 15, 2), target: { repMin: 10, repMax: 15, rir: 2 } }] }) });
    expect(slotFor(p, ROW).next.weightKg).toBe(52.5);
    expect(slotFor(p, LEGCURL).next.weightKg).toBe(42.5);
  });

  it("inside the range but not at the top: same weight, aim one more rep", () => {
    const s = nextBench(bench([[80, 8, 2], [80, 8, 2], [80, 7, 2]]));
    expect(s.next.weightKg).toBe(80);
    expect(s.next.targetReps).toBe(9);
    expect(s.reason.key).toBe("why.load.hold.reps");
  });

  it("well below the range: back off 2.5%", () => {
    const s = nextBench(bench(x3(80, 4, 1)));
    expect(s.next.weightKg).toBe(77.5);
    expect(s.reason.key).toBe("why.load.back.below");
  });

  it("reported RIR much lower than target: back off even though reps are in range", () => {
    const s = nextBench(bench([[80, 8, 0], [80, 8, 0], [80, 7, 0]]));
    expect(s.next.weightKg).toBe(77.5);
    expect(s.reason.key).toBe("why.load.back.rir");
  });

  it("much easier than target: bigger jump of two steps", () => {
    const s = nextBench(bench(x3(80, 8, 5)));
    expect(s.next.weightKg).toBe(85);
    expect(s.reason.key).toBe("why.load.up2");
  });

  it("a brutal difficulty rating with a small RIR shortfall also backs off", () => {
    const s = nextBench(bench(x3(80, 8, 1), { difficulty: 5 }));
    expect(s.next.weightKg).toBe(77.5);
  });

  it("'too easy' adds an extra step for a beginner at the top of the range", () => {
    const s = nextBench(bench(x3(80, 10, 2), { difficulty: 1 }), { profile: profile({ experience: "beginner" }) });
    expect(s.next.weightKg).toBe(85);
  });

  it("joint pain 2: hold the weight and suggest a swap", () => {
    const p = run(all, { workouts: history([bench(x3(80, 10, 2), { joint: 2 })]) });
    expect(slotFor(p, BENCH).next.weightKg).toBe(80);
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.hold.joint");
    const swap = p.swaps.find(s => s.exerciseId === BENCH)!;
    expect(swap.reason.key).toBe("why.swap.joint");
    expect(swap.candidates.length).toBeGreaterThan(0);
    expect(swap.candidates).not.toContain(BENCH);
  });

  it("joint pain 3: drop the load 10% and suggest a swap", () => {
    const p = run(all, { workouts: history([bench(x3(80, 10, 2), { joint: 3 })]) });
    expect(slotFor(p, BENCH).next.weightKg).toBe(72.5);
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.drop.joint");
    expect(p.swaps.some(s => s.exerciseId === BENCH)).toBe(true);
  });

  it("beginners progress linearly: in range at the target RIR is enough", () => {
    const s = nextBench(bench(x3(40, 8, 2)), { profile: profile({ experience: "beginner" }) });
    expect(s.next.weightKg).toBe(42.5);
  });

  it("intermediates and advanced lifters wait for the top of the range", () => {
    expect(nextBench(bench(x3(40, 8, 2))).next.weightKg).toBe(40);
    expect(nextBench(bench(x3(40, 8, 2)), { profile: profile({ experience: "advanced" }) }).next.weightKg).toBe(40);
  });

  it("advanced lifters take at most one step unless they had a lot in reserve", () => {
    const s = nextBench(bench(x3(80, 10, 3)), { profile: profile({ experience: "advanced" }) });
    expect(s.next.weightKg).toBe(82.5);
  });

  it("band exercises have no weight: progress via reps / next band tier", () => {
    const prog = program([session("Home", [{ ex: BANDROW, sets: 3, lo: 10, hi: 15 }])], [0, null, null, null, null, null, null]);
    const p = run(all, { program: prog, workouts: [workout(week(2), [{ ex: BANDROW, sets: x3(null, 15, 2), target: { repMin: 10, repMax: 15, rir: 2 } }])] });
    expect(slotFor(p, BANDROW).next.weightKg).toBeNull();
    expect(slotFor(p, BANDROW).reason.key).toBe("why.load.bands");
  });

  it("bands: at the top of the range the coach moves to the user's next band, by name", () => {
    const prog = program([session("Home", [{ ex: BANDROW, sets: 3, lo: 10, hi: 15 }])], [0, null, null, null, null, null, null]);
    const w = workout(week(2), [{ ex: BANDROW, sets: x3(null, 15, 2), target: { repMin: 10, repMax: 15, rir: 2 } }]);
    w.exercises[0].sets = w.exercises[0].sets.map(s => ({ ...s, bands: ["red"] }));
    const bands = [{ id: "yellow", name: "Yellow" }, { id: "red", name: "Red" }, { id: "blue", name: "Blue" }];
    const s = slotFor(run(all, { program: prog, workouts: [w], bands }), BANDROW);
    expect(s.last.bands).toEqual(["red"]);
    expect(s.next.bands).toEqual(["blue"]);
    expect(s.next.targetReps).toBe(10);
    expect(s.reason).toEqual({ key: "why.load.bandNext", params: { band: "Blue" } });

    // on the heaviest band with nothing stronger: the rep range moves up, sets go closer to failure
    w.exercises[0].sets = w.exercises[0].sets.map(x => ({ ...x, bands: ["blue"] }));
    const top = run(all, { program: prog, workouts: [w], bands });
    const ts = slotFor(top, BANDROW);
    expect(ts.next.bands).toEqual(["blue"]);
    expect([ts.next.repMin, ts.next.repMax, ts.next.rir]).toEqual([15, 20, 1]);
    expect(ts.reason).toEqual({ key: "why.load.bandReps", params: { lo: 15, hi: 20 } });
    expect(ts.extra.some(r => r.key === "why.load.bandKgHint")).toBe(true); // no kg entered: point to combinations

    // at 30 reps: outgrown, with the evidence-ranked advice and a swap suggestion
    const prog30 = program([session("Home", [{ ex: BANDROW, sets: 3, lo: 20, hi: 30 }])], [0, null, null, null, null, null, null]);
    const w30 = workout(week(2), [{ ex: BANDROW, sets: x3(null, 30, 1), target: { repMin: 20, repMax: 30, rir: 1 } }]);
    w30.exercises[0].sets = w30.exercises[0].sets.map(x => ({ ...x, bands: ["blue"] }));
    const out = run(all, { program: prog30, workouts: [w30], bands });
    expect(slotFor(out, BANDROW).reason.key).toBe("why.load.bandOutgrown");
    expect(slotFor(out, BANDROW).next.repMax).toBe(30);
    expect(slotFor(out, BANDROW).next.rir).toBeLessThanOrEqual(1);
    expect(out.swaps.some(s => s.exerciseId === BANDROW && s.reason.key === "why.swap.bandOutgrown")).toBe(true);

    // with the kg from the package, the coach goes past the heaviest band with the lightest stronger combination
    const withKg = [{ id: "yellow", name: "Yellow", kg: 5 }, { id: "red", name: "Red", kg: 10 }, { id: "blue", name: "Blue", kg: 20 }];
    const combo = slotFor(run(all, { program: prog, workouts: [w], bands: withKg }), BANDROW);
    expect(combo.next.bands).toEqual(["yellow", "blue"]);
    expect(combo.reason).toEqual({ key: "why.load.bandCombo", params: { band: "Yellow + Blue" } });

    // mid-range: keep the band, add a rep
    w.exercises[0].sets = w.exercises[0].sets.map(x => ({ ...x, reps: 12, bands: ["red"] }));
    const mid = slotFor(run(all, { program: prog, workouts: [w], bands }), BANDROW);
    expect(mid.next.bands).toEqual(["red"]);
    expect(mid.reason.key).toBe("why.load.hold.reps");
  });

  it("dumbbells never go above the heaviest pair the user owns; then reps go up", () => {
    const DB = "Dumbbell_Bench_Press";
    const prog = program([session("A", [{ ex: DB, sets: 3, lo: 8, hi: 12 }])], [0, null, null, null, null, null, null]);
    const at = (w: number, reps: number, lo = 8, hi = 12) => [workout(week(2), [{ ex: DB, sets: x3(w, reps, 2), target: { repMin: lo, repMax: hi, rir: 2 } }])];
    const prof = (max: number | null) => profile({ dumbbellMaxKg: max });
    // free to progress without a cap
    expect(slotFor(run(all, { program: prog, workouts: at(20, 12) , profile: prof(null) }), DB).next.weightKg).toBeGreaterThan(20);
    // capped: 21 kg is the heaviest, so the jump stops there
    const cap = slotFor(run(all, { program: prog, workouts: at(20, 12), profile: prof(21) }), DB);
    expect(cap.next.weightKg).toBe(21);
    expect(cap.reason.key).toBe("why.load.dbCap");
    // at the heaviest: same weight, higher rep range, close to failure
    const reps = slotFor(run(all, { program: prog, workouts: at(21, 12), profile: prof(21) }), DB);
    expect([reps.next.weightKg, reps.next.repMin, reps.next.repMax, reps.next.rir]).toEqual([21, 10, 15, 1]);
    expect(reps.reason.key).toBe("why.load.dbReps");
    // at 30 reps: outgrown, with swaps
    const out = run(all, { program: program([session("A", [{ ex: DB, sets: 3, lo: 20, hi: 30 }])], [0, null, null, null, null, null, null]), workouts: at(21, 30, 20, 30), profile: prof(21) });
    expect(slotFor(out, DB).reason.key).toBe("why.load.dbOutgrown");
    expect(slotFor(out, DB).next.weightKg).toBe(21);
  });

  it("bodyweight lifts at the top of the range suggest adding load", () => {
    const prog = program([session("Pull", [{ ex: PULLUP, sets: 3, lo: 6, hi: 10 }])], [0, null, null, null, null, null, null]);
    const p = run(all, { program: prog, workouts: [workout(week(2), [{ ex: PULLUP, sets: x3(null, 12, 2), target: { repMin: 6, repMax: 10, rir: 2 } }])] });
    expect(slotFor(p, PULLUP).next.weightKg).toBe(2.5);
    expect(slotFor(p, PULLUP).reason.key).toBe("why.load.bw");
  });

  it("lb users get lb-sized jumps", () => {
    const s = nextBench(bench(x3(45.359, 10, 2)), { profile: profile({ weightUnit: "lb" }) }); // 100 lb
    expect(s.next.weightKg).toBeCloseTo(47.627, 1); // 105 lb
  });

  it("assisted machines reduce the assistance to progress", () => {
    const prog = program([session("Pull", [{ ex: "x-assisted-pullup-machine", sets: 3, lo: 6, hi: 10 }])], [0, null, null, null, null, null, null]);
    const p = run(all, { program: prog, workouts: [workout(week(2), [{ ex: "x-assisted-pullup-machine", sets: x3(60, 10, 2), target: { repMin: 6, repMax: 10, rir: 2 } }])] });
    expect(slotFor(p, "x-assisted-pullup-machine").next.weightKg).toBe(57.5);
  });

  it("a plateau over four sessions adds a note and proposes a variation", () => {
    const ws = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].map(d => workout(d, [bench(x3(80, 8, 2))], { mesoWeek: 1 }));
    const p = run(all, { workouts: ws });
    expect(slotFor(p, BENCH).extra.some(r => r.key === "why.load.plateau")).toBe(true);
    expect(p.swaps.find(s => s.exerciseId === BENCH)?.reason.key).toBe("why.swap.plateau");
  });

  it("a rejected load increase is respected for two weeks", () => {
    const prog = standardProgram();
    const slotId = prog.sessions[0].exercises[0].id;
    const p = run(all, { program: prog, workouts: history([bench(x3(80, 10, 2))]), rejections: [{ weekKey: week(2), scope: "slot", id: slotId, kind: "load" }] });
    expect(slotFor(p, BENCH).next.weightKg).toBe(80);
    expect(slotFor(p, BENCH).reason.key).toBe("why.load.hold.rejected");
  });

  it("an old rejection no longer applies", () => {
    const prog = standardProgram();
    const slotId = prog.sessions[0].exercises[0].id;
    const p = run(all, { program: prog, workouts: history([bench(x3(80, 10, 2))]), rejections: [{ weekKey: week(-3), scope: "slot", id: slotId, kind: "load" }] });
    expect(slotFor(p, BENCH).next.weightKg).toBe(82.5);
  });

  it("exercises not done for a month get a stale-return reduction", () => {
    const ws = [workout("2026-09-08", [bench(x3(80, 8, 2))], { mesoWeek: 1 }), ...history([{ ex: ROW, sets: x3(50, 10, 2), target: { repMin: 8, repMax: 12, rir: 2 } }])];
    const s = slotFor(run(all, { workouts: ws }), BENCH);
    expect(s.reason.key).toBe("why.load.stale");
    expect(s.next.weightKg!).toBeLessThan(80);
  });

  it("strength goal: main compound lifts move to 3-6 reps with longer rests", () => {
    const p = run(all, { profile: profile({ goal: "strength" }), workouts: history([bench(x3(80, 8, 2))]) });
    const s = slotFor(p, BENCH);
    expect([s.next.repMin, s.next.repMax]).toEqual([3, 6]);
    expect(s.next.restSec).toBe(210);
    expect(s.extra.some(r => r.key === "why.load.strengthRange")).toBe(true);
  });

  it("cut phase keeps intensity: a mild shortfall does not reduce the load", () => {
    const spec = bench([[80, 8, 0], [80, 8, 0], [80, 7, 0]]);
    expect(nextBench(spec).next.weightKg).toBe(77.5);
    expect(nextBench(spec, { profile: profile({ phase: "cut" }) }).next.weightKg).toBe(80);
  });

  it("bulk phase lets a beginner jump faster when the set was easy", () => {
    const spec = bench(x3(80, 10, 3));
    expect(nextBench(spec, { profile: profile({ experience: "beginner" }) }).next.weightKg).toBe(82.5);
    expect(nextBench(spec, { profile: profile({ experience: "beginner", phase: "bulk" }) }).next.weightKg).toBe(85);
    expect(nextBench(bench(x3(80, 10, 2)), { profile: profile({ experience: "beginner", phase: "bulk" }) }).next.weightKg).toBe(82.5); // no surplus, no bonus
  });

  it("summer heat is lenient: a small dip below the range holds instead of backing off", () => {
    const heat = { program: standardProgram({ mesoStartDayKey: "2026-07-20" }), today: "2026-08-02", targetWeekStart: "2026-08-03" };
    const ws = [workout("2026-07-27", [bench(x3(80, 4, 2))], { mesoWeek: 2 }), workout("2026-07-30", [{ ex: SQUAT, sets: x3(100, 6, 2) }], { mesoWeek: 2 })];
    expect(slotFor(run(all, { ...heat, workouts: ws }), BENCH).next.weightKg).toBe(80); // 2 reps under the range: held, not punished
    expect(nextBench(bench(x3(80, 4, 2))).next.weightKg).toBe(77.5); // same performance in autumn: backs off
  });
});

/* ------------------------------------------------------------------ volume */
describe("weekly volume per muscle", () => {
  const chestSore = (ws: ReturnType<typeof history>, level: 0 | 1 | 2 | 3) => [soreRecord(ws[2].id, "chest", level)];

  it("recovered, flat and under-pumped -> add two sets", () => {
    const ws = history([bench(x3(80, 8, 2), { pump: 1 })]);
    const m = muscleFor(run(all, { workouts: ws, soreness: chestSore(ws, 0) }), "chest");
    expect(m.reason.key).toBe("why.vol.add.recovered");
    expect(m.delta).toBe(2);
    expect(m.newSets).toBe(8);
  });

  it("still sore and performance dropped -> remove a set", () => {
    const ws = history([bench(x3(74, 8, 2))], { week1Upper: [bench(x3(80, 8, 2))] });
    const m = muscleFor(run(all, { workouts: ws, soreness: chestSore(ws, 3) }), "chest");
    expect(m.reason.key).toBe("why.vol.cut.sore");
    expect(m.delta).toBe(-1);
  });

  it("still sore but performing fine -> hold", () => {
    const ws = history([bench(x3(80, 8, 2))]);
    const m = muscleFor(run(all, { workouts: ws, soreness: chestSore(ws, 3) }), "chest");
    expect(m.reason.key).toBe("why.vol.hold.sore");
    expect(m.delta).toBe(0);
  });

  it("performance dropped without soreness -> hold, not add", () => {
    const ws = history([bench(x3(72, 8, 2))], { week1Upper: [bench(x3(80, 8, 2))] });
    expect(muscleFor(run(all, { workouts: ws }), "chest").reason.key).toBe("why.vol.hold.perf");
  });

  it("'too much volume' feedback removes a set", () => {
    const m = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2), { volume: 4 })]) }), "chest");
    expect(m.reason.key).toBe("why.vol.cut.toomuch");
    expect(m.delta).toBe(-1);
  });

  it("at MRV hold; above MRV trim back to it", () => {
    const big = (n: number) => program([session("Chest", [{ ex: BENCH, sets: 6, lo: 6, hi: 10 }, { ex: INCLINE, sets: 6, lo: 8, hi: 12 }, { ex: "Cable_Crossover", sets: 5, lo: 10, hi: 15 }, { ex: "Dumbbell_Flyes", sets: n, lo: 10, hi: 15 }])], [0, null, null, null, null, null, null]);
    const ws = [workout(week(2), [bench(x3(80, 8, 2))])];
    expect(muscleFor(run(all, { program: big(5), workouts: ws }), "chest").reason.key).toBe("why.vol.hold.mrv");
    const over = muscleFor(run(all, { program: big(7), workouts: ws }), "chest");
    expect(over.reason.key).toBe("why.vol.cut.mrv");
    expect(over.newSets).toBeLessThan(over.lastSets);
  });

  it("joint pain 2 holds the muscle's volume; 3 cuts two sets", () => {
    const hold = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2), { joint: 2 })]) }), "chest");
    expect(hold.reason.key).toBe("why.vol.hold.joint");
    expect(hold.delta).toBe(0);
    const cut = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2), { joint: 3 })]) }), "chest");
    expect(cut.reason.key).toBe("why.vol.cut.joint");
    expect(cut.delta).toBe(-2);
  });

  it("days before the program existed do not count as missed sessions", () => {
    const prog = standardProgram({ createdAt: `${week(2)}T09:00:00.000Z` });
    expect(plannedSoFar(prog, week(1), addDays(week(2), 3))).toBe(0);
    expect(plannedSoFar(prog, week(2), addDays(week(2), 6))).toBe(plannedSessionCount(prog));
    expect(plannedSoFar(standardProgram({ createdAt: `${addDays(week(1), 2)}T09:00:00.000Z` }), week(1), week(2))).toBeLessThan(plannedSessionCount(prog));
  });

  it("low adherence holds volume", () => {
    const p = run(all, { workouts: [workout(week(2), [bench(x3(80, 8, 2), { pump: 0 })])], soreness: [] });
    expect(muscleFor(p, "chest").reason.key).toBe("why.vol.hold.adherence");
    expect(p.notes.some(n => n.reason.key === "why.note.adherence")).toBe(true);
  });

  it("a week still in progress is not counted as missed sessions", () => {
    // Planning on Monday of week 2 (basis = week 2 itself): only Monday's session was due so far, and it was done.
    const p = run(all, { today: week(2), targetWeekStart: week(3), workouts: [workout(week(1), [bench(x3(80, 8, 2))]), workout(addDays(week(1), 3), [{ ex: SQUAT, sets: x3(100, 6, 2) }]), workout(week(2), [bench(x3(80, 8, 2))])] });
    expect(p.notes.some(n => n.reason.key === "why.note.adherence")).toBe(false);
    expect(muscleFor(p, "chest").reason.key).not.toBe("why.vol.hold.adherence");
  });

  it("default progression below MEV adds a set toward MEV", () => {
    const m = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2))]) }), "chest");
    expect(m.reason.key).toBe("why.vol.add.mev");
    expect(m.delta).toBe(1);
  });

  it("poor sleep before most of last week's sessions holds volume instead of adding", () => {
    const prog = program([session("A", [{ ex: BENCH, sets: 5, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 5, lo: 8, hi: 12 }])], [0, null, null, 1, null, null, null]);
    const ws = (sleep: 1 | 2 | 3) => [workout(week(2), [bench(x3(80, 8, 2))], { sleep }), workout(addDays(week(2), 3), [bench(x3(80, 8, 2))], { sleep })];
    const poor = run(all, { program: prog, workouts: ws(1) });
    expect(muscleFor(poor, "chest").reason.key).toBe("why.vol.hold.sleep");
    expect(muscleFor(poor, "chest").delta).toBe(0);
    expect(poor.notes.some(n => n.reason.key === "why.note.sleep")).toBe(true);
    expect(muscleFor(run(all, { program: prog, workouts: ws(3) }), "chest").reason.key).toBe("why.vol.add.default");
  });

  it("repeated poor sleep counts toward an early deload", () => {
    const f = (d: string, ex: string, w: number) => workout(d, [{ ex, sets: x3(w, 8, 2) }], { sleep: 1 });
    const ws = [f(week(2), BENCH, 80), f(addDays(week(2), 3), SQUAT, 100), f(week(3), BENCH, 80), f(addDays(week(3), 3), SQUAT, 100)];
    const p = run(all, { today: addDays(week(3), 6), targetWeekStart: week(4), workouts: ws });
    expect(p.deload.type).toBe("early");
    expect(p.deload.reasons).toContainEqual({ key: "why.deload.early.sleep", params: { poor: 4, n: 4 } });
  });

  it("default progression above MEV adds one set toward MAV", () => {
    const prog = program([session("A", [{ ex: BENCH, sets: 5, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 5, lo: 8, hi: 12 }])], [0, null, null, 1, null, null, null]);
    const m = muscleFor(run(all, { program: prog, workouts: [workout(week(2), [bench(x3(80, 8, 2))]), workout(addDays(week(2), 3), [bench(x3(80, 8, 2))])] }), "chest");
    expect(m.reason.key).toBe("why.vol.add.default");
    expect(m.delta).toBe(1);
  });

  it("cut phase holds volume above MEV (and still rises to MEV when below)", () => {
    const prog = program([session("A", [{ ex: BENCH, sets: 5, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 5, lo: 8, hi: 12 }])], [0, null, null, 1, null, null, null]);
    const ws = [workout(week(2), [bench(x3(80, 8, 2))]), workout(addDays(week(2), 3), [bench(x3(80, 8, 2))])];
    expect(muscleFor(run(all, { program: prog, workouts: ws, profile: profile({ phase: "cut" }) }), "chest").reason.key).toBe("why.vol.hold.cut");
    expect(muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2))]), profile: profile({ phase: "cut" }) }), "chest").reason.key).toBe("why.vol.add.mev");
  });

  it("cut phase lowers the recoverable ceiling by about 15%", () => {
    const base = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2))]) }), "chest").band.mrv;
    const cut = muscleFor(run(all, { workouts: history([bench(x3(80, 8, 2))]), profile: profile({ phase: "cut" }) }), "chest").band.mrv;
    expect(cut).toBeLessThan(base);
    expect(cut / base).toBeGreaterThan(0.75);
    expect(cut / base).toBeLessThan(0.95);
  });

  it("bulk phase raises the ceiling", () => {
    const base = muscleFor(run(all), "chest").band.mrv;
    expect(muscleFor(run(all, { profile: profile({ phase: "bulk" }) }), "chest").band.mrv).toBeGreaterThan(base);
  });

  it("beginners add at most one set per week; intermediates may add two", () => {
    const ws = history([bench(x3(80, 8, 2), { pump: 1 })]);
    const sore = [soreRecord(ws[2].id, "chest", 0)];
    expect(muscleFor(run(all, { workouts: ws, soreness: sore, profile: profile({ experience: "beginner" }) }), "chest").delta).toBe(1);
    expect(muscleFor(run(all, { workouts: ws, soreness: sore }), "chest").delta).toBe(2);
  });

  it("landmarks scale with experience and goal", () => {
    const chest = (o: Parameters<typeof profile>[0]) => muscleFor(run(all, { profile: profile(o) }), "chest").band;
    expect(chest({ experience: "advanced" }).mev).toBeGreaterThan(chest({ experience: "intermediate" }).mev);
    expect(chest({ experience: "beginner" }).mrv).toBeLessThan(chest({ experience: "intermediate" }).mrv);
    expect(chest({ goal: "strength" }).mavHigh).toBeLessThan(chest({ goal: "muscle" }).mavHigh);
    const b = chest({});
    expect(b.mv).toBeLessThanOrEqual(b.mev);
    expect(b.mev).toBeLessThanOrEqual(b.mavLow);
    expect(b.mavLow).toBeLessThanOrEqual(b.mavHigh);
    expect(b.mavHigh).toBeLessThanOrEqual(b.mrv);
  });

  it("never puts more than the session cap of hard sets for one muscle in one session", () => {
    const one = program([session("Chest day", [{ ex: BENCH, sets: 4, lo: 6, hi: 10 }, { ex: INCLINE, sets: 4, lo: 8, hi: 12 }, { ex: "Cable_Crossover", sets: 2, lo: 10, hi: 15 }])], [0, null, null, null, null, null, null]);
    const p = run(all, { program: one, profile: profile({ experience: "advanced" }) });
    const chest = muscleFor(p, "chest");
    expect(chest.newSets).toBeLessThanOrEqual(COACH_CONFIG.volume.sessionCap);
    expect(chest.unallocated).toBeGreaterThan(0);
    expect(chest.extra.some(r => r.key === "why.vol.unallocated")).toBe(true);
  });

  it("spreads added sets across sessions", () => {
    const two = program([
      session("A", [{ ex: BENCH, sets: 3, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 3, lo: 8, hi: 12 }]),
    ], [0, null, 1, null, null, null, null]);
    const p = run(all, { program: two });
    const sets = p.slots.map(s => s.next.sets);
    expect(Math.abs(sets[0] - sets[1])).toBeLessThanOrEqual(1);
  });

  it("never adds sets to exercises beyond the per-exercise maximum", () => {
    const p = run(all, { program: program([session("C", [{ ex: BENCH, sets: 6, lo: 6, hi: 10 }])], [0, null, null, null, null, null, null]) });
    expect(slotFor(p, BENCH).next.sets).toBeLessThanOrEqual(COACH_CONFIG.volume.maxSetsPerExercise);
  });

  it("a rejected 'add sets' suggestion is not repeated straight away", () => {
    const prog = program([session("A", [{ ex: BENCH, sets: 5, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 5, lo: 8, hi: 12 }])], [0, null, null, 1, null, null, null]);
    const ws = [workout(week(2), [bench(x3(80, 8, 2))]), workout(addDays(week(2), 3), [bench(x3(80, 8, 2))])];
    const m = muscleFor(run(all, { program: prog, workouts: ws, rejections: [{ weekKey: week(2), scope: "muscle", id: "chest", kind: "sets" }] }), "chest");
    expect(m.reason.key).toBe("why.vol.hold.rejected");
  });

  it("maintain goal stops climbing earlier than a muscle-building goal", () => {
    const prog = program([session("A", [{ ex: BENCH, sets: 6, lo: 6, hi: 10 }]), session("B", [{ ex: INCLINE, sets: 5, lo: 8, hi: 12 }])], [0, null, null, 1, null, null, null]);
    const ws = [workout(week(2), [bench(x3(80, 8, 2))]), workout(addDays(week(2), 3), [bench(x3(80, 8, 2))])];
    expect(muscleFor(run(all, { program: prog, workouts: ws, profile: profile({ goal: "maintain" }) }), "chest").delta).toBe(0);
    expect(muscleFor(run(all, { program: prog, workouts: ws }), "chest").delta).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------- season / context / body */
describe("seasons, disruptions and body weight", () => {
  const augWs = [workout("2026-07-27", [bench(x3(80, 8, 2))], { mesoWeek: 2 }), workout("2026-07-30", [{ ex: SQUAT, sets: x3(100, 6, 2) }], { mesoWeek: 2 })];

  it("Japanese summer: longer rests, hydration reminder, slightly lower MRV", () => {
    const mkProg = (start: string) => program([session("U", [{ ex: BENCH, sets: 3, lo: 6, hi: 10 }, { ex: CALF, sets: 3, lo: 10, hi: 15, rest: 60 }])], [0, null, null, null, null, null, null], { mesoStartDayKey: start });
    const aug = run(all, { program: mkProg("2026-07-20"), today: "2026-08-02", targetWeekStart: "2026-08-03", workouts: augWs });
    const oct = run(all, { program: mkProg(START), workouts: [workout(week(2), [bench(x3(80, 8, 2))])] });
    expect(slotFor(aug, CALF).next.restSec).toBe(105);
    expect(slotFor(oct, CALF).next.restSec).toBe(90);
    expect(aug.notes.some(n => n.reason.key === "why.season.hydrate")).toBe(true);
    expect(muscleFor(aug, "chest").band.mrv).toBeLessThan(muscleFor(oct, "chest").band.mrv);
  });

  it("rest increases are idempotent: an already-lengthened rest is not added to again", () => {
    const prog = program([session("U", [{ ex: CALF, sets: 3, lo: 10, hi: 15, rest: 105 }])], [0, null, null, null, null, null, null], { mesoStartDayKey: "2026-07-20" });
    const p = run(all, { program: prog, today: "2026-08-02", targetWeekStart: "2026-08-03", workouts: augWs });
    expect(slotFor(p, CALF).next.restSec).toBe(105);
  });

  it("Japanese winter reminds about warm-ups and mobility", () => {
    const p = run(all, { program: standardProgram({ mesoStartDayKey: "2026-12-07" }), today: "2026-12-13", targetWeekStart: "2026-12-14" });
    expect(p.notes.some(n => n.reason.key === "why.season.mobility")).toBe(true);
  });

  it("no seasonal notes in autumn", () => {
    expect(run(all).notes.some(n => n.reason.key.startsWith("why.season"))).toBe(false);
  });

  it("flags Golden Week, Obon and New Year as likely disrupted weeks", () => {
    const key = (target: string) => run(all, { today: addDays(target, -1), targetWeekStart: target, program: standardProgram({ mesoStartDayKey: target }) }).notes.map(n => n.reason.key);
    expect(key("2026-04-27")).toContain("why.disrupt.goldenWeek");
    expect(key("2026-08-10")).toContain("why.disrupt.obon");
    expect(key("2026-12-28")).toContain("why.disrupt.newYear");
    expect(key("2026-10-19").some(k => k.startsWith("why.disrupt"))).toBe(false);
  });

  it("region changes the season: southern summer is December", () => {
    expect(seasonFor("2026-12-15", "south")?.id).toBe("south-summer");
    expect(seasonFor("2026-12-15", "north")?.id).toBe("north-winter");
    expect(seasonFor("2026-07-15", "JP")?.id).toBe("jp-summer");
    expect(seasonFor("2026-10-15", "JP")).toBeNull();
    expect(disruptionsIn("2026-04-27", "north")).toEqual([]);
  });

  it("losing weight too fast on a cut warns and tones volume down", () => {
    const bw = Array.from({ length: 8 }, (_, i) => ({ dayKey: addDays("2026-10-05", i * 2), kg: 80 - i * 0.5 }));
    const ws = history([bench(x3(80, 8, 2))]);
    const p = run(all, { workouts: ws, profile: profile({ phase: "cut" }), bodyWeights: bw });
    expect(p.notes.some(n => n.reason.key === "why.note.cutFast")).toBe(true);
    expect(muscleFor(p, "chest").extra.some(r => r.key === "why.vol.bwfast")).toBe(true);
  });

  it("gaining too fast on a bulk is noted; steady weight is not", () => {
    const up = Array.from({ length: 8 }, (_, i) => ({ dayKey: addDays("2026-10-05", i * 2), kg: 80 + i * 0.4 }));
    expect(run(all, { workouts: history([bench(x3(80, 8, 2))]), profile: profile({ phase: "bulk" }), bodyWeights: up }).notes.some(n => n.reason.key === "why.note.bulkFast")).toBe(true);
    const flat = up.map(p => ({ ...p, kg: 80 }));
    expect(run(all, { workouts: history([bench(x3(80, 8, 2))]), profile: profile({ phase: "bulk" }), bodyWeights: flat }).notes.some(n => n.reason.key === "why.note.bulkFast")).toBe(false);
  });

  it("a cut always carries the 'maintaining strength is a win' expectation", () => {
    expect(run(all, { profile: profile({ phase: "cut" }) }).notes.some(n => n.reason.key === "why.note.cut" && n.kind === "good")).toBe(true);
  });
});

/* ------------------------------------------------------------------ utilities */
describe("engine utilities", () => {
  it("RIR ladders descend and end at 0-1 for every mesocycle length", () => {
    for (const [acc, ladder] of Object.entries(COACH_CONFIG.rirLadder)) {
      expect(ladder).toHaveLength(Number(acc));
      expect(ladder[0]).toBe(3);
      expect(ladder[ladder.length - 1]).toBeLessThanOrEqual(1);
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeLessThanOrEqual(ladder[i - 1]);
    }
  });

  it("the plan follows the ladder across the mesocycle", () => {
    const rirAt = (n: number) => run(all, { today: addDays(week(n), -1), targetWeekStart: week(n), workouts: history([bench(x3(80, 8, 2))]).map(w => ({ ...w })) }).targetRir;
    expect([1, 2, 3, 4, 5].map(rirAt)).toEqual([3, 2, 2, 1, 0]);
  });

  it("is deterministic and does not mutate its input", () => {
    const input = { workouts: history([bench(x3(80, 10, 2))]), program: standardProgram() };
    const before = JSON.stringify(input);
    const a = run(all, input), b = run(all, input);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("body weight rate: smoothed weekly change, null on too little data", () => {
    const pts = Array.from({ length: 8 }, (_, i) => ({ dayKey: addDays("2026-10-01", i * 2), kg: 80 - i * 0.3 }));
    const r = bodyWeightRate(pts, "2026-10-15", 14, 4)!;
    expect(r).toBeLessThan(0);
    expect(Math.abs(r)).toBeGreaterThan(0.005);
    expect(bodyWeightRate(pts.slice(0, 2), "2026-10-15", 14, 4)).toBeNull();
    expect(bodyWeightRate([], "2026-10-15", 14, 4)).toBeNull();
  });

  it("increments are equipment-aware", () => {
    const ex = (id: string) => all.find(e => e.id === id)!;
    const c = COACH_CONFIG;
    expect(increment(ex(BENCH), 80, "kg", c)).toBe(2.5);
    expect(increment(ex(SQUAT), 120, "kg", c)).toBe(5);
    expect(increment(ex(SQUAT), 60, "kg", c)).toBe(2.5);
    expect(increment(ex(CURL), 8, "kg", c)).toBe(1);
    expect(increment(ex(CURL), 20, "kg", c)).toBe(2);
    expect(increment(ex(BANDROW), 0, "kg", c)).toBeNull();
    expect(increment(ex(PUSHDOWN), 30, "kg", c)).toBe(2.5);
    expect(increment(ex(BENCH), 80, "lb", c)).toBeCloseTo(2.268, 2);
  });

  it("explains every suggestion with a reason key", () => {
    const p = run(all, { workouts: history([bench(x3(80, 10, 2))]) });
    for (const s of p.slots) expect(s.reason.key).toMatch(/^why\./);
    for (const m of p.muscles) expect(m.reason.key).toMatch(/^why\./);
  });
});
