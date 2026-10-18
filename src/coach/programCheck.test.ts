import { beforeAll, describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import { myEquipment } from "../library/equipment";
import type { Exercise } from "../library/types";
import { checkProgram, type CheckInput } from "./programCheck";
import { BENCH, CALF, CURL, INCLINE, LEGCURL, PUSHDOWN, ROW, SQUAT, profile, program, session, week, workout } from "./fixtures";

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });

const gym = myEquipment({ equipment: "gym" });
const base = (over: Partial<CheckInput> = {}): CheckInput => ({
  program: program([
    session("Upper", [{ ex: BENCH, sets: 4, lo: 6, hi: 10 }, { ex: INCLINE, sets: 4, lo: 8, hi: 12 }, { ex: ROW, sets: 4, lo: 8, hi: 12 }, { ex: CURL, sets: 4, lo: 10, hi: 15 }, { ex: PUSHDOWN, sets: 4, lo: 10, hi: 15 }]),
    session("Lower", [{ ex: SQUAT, sets: 4, lo: 5, hi: 8 }, { ex: CALF, sets: 4, lo: 10, hi: 15 }]),
  ], [0, null, null, 1, null, 0, null]),
  all, lookup: id => all.find(e => e.id === id), profile: profile(), focus: [], have: gym, workouts: [], today: week(2), ...over,
});
const byId = (f: ReturnType<typeof checkProgram>, id: string) => f.find(x => x.id === id);

describe("program check", () => {
  it("finds a muscle the program barely trains and suggests fitting exercises", () => {
    const f = checkProgram(base());
    const ham = byId(f, "under:hamstrings");
    expect(ham).toMatchObject({ kind: "under", muscle: "hamstrings", focus: false });
    if (ham?.kind !== "under") throw new Error();
    expect(ham.candidates.length).toBeGreaterThan(0);
    expect(ham.candidates.every(id => all.find(e => e.id === id)!.primary[0] === "hamstrings")).toBe(true);
    expect(ham.addSets).toBeGreaterThanOrEqual(2);
  });

  it("a focus muscle aims for the growth range, not just the minimum", () => {
    const withLegCurl = base().program;
    withLegCurl.sessions[1].exercises.push({ ...withLegCurl.sessions[1].exercises[1], id: "lc", exerciseId: LEGCURL, sets: 6 });
    expect(byId(checkProgram(base({ program: withLegCurl })), "under:hamstrings")).toBeUndefined();
    const f = byId(checkProgram(base({ program: withLegCurl, focus: ["hamstrings"] })), "under:hamstrings");
    expect(f).toMatchObject({ focus: true });
  });

  it("never adds work to a muscle with recent joint pain", () => {
    const sore = workout(week(2), [{ ex: LEGCURL, sets: [[40, 10, 2]], joint: 2 }]);
    const f = checkProgram(base({ workouts: [sore] }));
    expect(byId(f, "under:hamstrings")).toBeUndefined();
    expect(byId(f, "pain:hamstrings")).toMatchObject({ kind: "pain" });
  });

  it("only suggests exercises the user can do with their equipment", () => {
    const f = checkProgram(base({ have: myEquipment({ equipment: "home", myEquipment: ["dumbbell", "bench"] }) }));
    const ham = byId(f, "under:hamstrings");
    if (ham?.kind !== "under") throw new Error("expected a hamstrings suggestion");
    for (const id of ham.candidates) expect(all.find(e => e.id === id)!.equipment.every(e => ["dumbbell", "bench", "bodyweight", "other"].includes(e))).toBe(true);
  });

  it("flags more than a muscle can recover from, and too much pushing vs pulling", () => {
    const heavy = program([session("Push", [{ ex: BENCH, sets: 12, lo: 6, hi: 10 }, { ex: INCLINE, sets: 12, lo: 8, hi: 12 }])], [0, null, 0, null, null, null, null]);
    const f = checkProgram(base({ program: heavy }));
    expect(byId(f, "over:chest")).toMatchObject({ kind: "over" });
    expect(f.some(x => x.kind === "crowded" && x.muscle === "chest")).toBe(true);
    expect(byId(f, "under:lats")).toBeDefined(); // no pulling at all: the back suggestion covers the balance
  });

  it("ignored findings come back after four weeks", () => {
    expect(byId(checkProgram(base({ dismissed: { "under:hamstrings": week(2) } })), "under:hamstrings")).toBeUndefined();
    expect(byId(checkProgram(base({ dismissed: { "under:hamstrings": week(1) }, today: week(6) })), "under:hamstrings")).toBeDefined();
  });

  it("a session that runs twice a week counts once per finding, and needs half the sets per session", () => {
    const twice = program([session("Full", [{ ex: BENCH, sets: 3, lo: 6, hi: 10 }, { ex: SQUAT, sets: 3, lo: 5, hi: 8 }, { ex: ROW, sets: 3, lo: 8, hi: 12 }])], [0, null, 0, null, null, null, null]);
    const f = checkProgram(base({ program: twice }));
    const ids = f.map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const ham = f.find(x => x.id === "under:hamstrings");
    if (ham?.kind !== "under") throw new Error("expected hamstrings");
    expect(ham.addSets).toBeLessThanOrEqual(2); // ×2 sessions a week
  });

  it("several suggestions spread over the week instead of piling onto one session", () => {
    const f = checkProgram(base()).filter(x => x.kind === "under" || x.kind === "balance") as { sessionId: string }[];
    expect(f.length).toBeGreaterThan(1);
    expect(new Set(f.map(x => x.sessionId)).size).toBeGreaterThan(1);
  });

  it("warns when a muscle is over its limit only through exercises that train it secondarily", () => {
    const pressing = program([session("Press", [{ ex: BENCH, sets: 12, lo: 6, hi: 10 }, { ex: INCLINE, sets: 12, lo: 8, hi: 12 }, { ex: "Dumbbell_Shoulder_Press", sets: 12, lo: 8, hi: 12 }])], [0, null, 0, null, 0, null, null]);
    const f = checkProgram(base({ program: pressing }));
    expect(f.find(x => x.id === "overNote:triceps")).toMatchObject({ kind: "overNote", muscle: "triceps" });
  });

  it("push/pull suggestions are back exercises only, and an ignored back suggestion no longer hides them", () => {
    const pushy = program([
      session("A", [{ ex: BENCH, sets: 4, lo: 6, hi: 10 }, { ex: INCLINE, sets: 4, lo: 8, hi: 12 }, { ex: "Dumbbell_Shoulder_Press", sets: 4, lo: 8, hi: 12 }, { ex: ROW, sets: 2, lo: 8, hi: 12 }]),
      session("B", [{ ex: SQUAT, sets: 4, lo: 5, hi: 8 }, { ex: LEGCURL, sets: 4, lo: 10, hi: 15 }]),
    ], [0, null, 1, null, 0, null, null]);
    const f = checkProgram(base({ program: pushy, dismissed: { "under:lats": week(2), "under:middle-back": week(2) } }));
    const bal = f.find(x => x.id === "balance");
    if (bal?.kind !== "balance") throw new Error("expected a push/pull suggestion");
    for (const id of bal.candidates) expect(["lats", "middle-back"]).toContain(all.find(e => e.id === id)!.primary[0]);
  });
});
