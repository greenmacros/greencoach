import { describe, expect, it } from "vitest";
import { decodeNutrition, nutritionCodeFrom, nutritionNotes, summarize, type NutritionPlan } from "./nutrition";

/** Same encoding GreenMacros uses (src/lib/greencoach.js there). */
const encode = (o: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const week = (days: NutritionPlan["days"], at = "2026-10-12T00:00:00.000Z"): NutritionPlan => ({ v: 1, src: "greenmacros", at, days, targets: days.map(() => null) });
const day = (kcal: number, p: number): [number, number, number, number] => [kcal, p, 300, 70];

describe("GreenMacros nutrition link", () => {
  it("decodes what GreenMacros sends and finds it inside a pasted message", () => {
    const w = week([day(2500, 150), null, day(2300, 140), null, day(2500, 150), null, null]);
    const text = `My plan: https://greenmacros.github.io/greencoach/#nutrition=${encode(w)} see you`;
    expect(decodeNutrition(nutritionCodeFrom(text)!)).toEqual(w);
  });

  it("rejects damaged links, other apps and impossible numbers", () => {
    expect(() => decodeNutrition("@@@")).toThrow("bad-nutrition");
    expect(() => decodeNutrition(encode({ v: 1, src: "other", at: "2026-10-12", days: [day(1, 1)] }))).toThrow("bad-nutrition");
    expect(() => decodeNutrition(encode(week([null, null, null, null, null, null, null])))).toThrow("bad-nutrition");
    const odd = decodeNutrition(encode({ ...week([day(2500, 150)]), days: [[-5, 1, 1, 1], day(2400, 9999), day(2400, 140)] }));
    expect(odd.days.slice(0, 3)).toEqual([null, null, day(2400, 140)]);
  });

  it("averages the planned days and checks protein per kg (more on a cut)", () => {
    const s = summarize(week([day(2500, 150), null, day(2300, 130), null, null, null, null]), "2026-10-14");
    expect([s.plannedDays, s.kcal, s.protein, s.ageDays]).toEqual([2, 2400, 140, 2]);
    expect(nutritionNotes(s, "maintain", 80, null)).toEqual([{ kind: "good", key: "why.nut.proteinOk", params: { g: 140, perKg: 1.8, need: 1.6, target: 128 } }]);
    expect(nutritionNotes(s, "cut", 90, null)[0]).toMatchObject({ kind: "warn", key: "why.nut.proteinLow", params: { need: 1.8, target: 162 } });
    expect(nutritionNotes(s, "maintain", null, null)).toEqual([]); // no body weight: no per-kg claim
  });

  it("estimates maintenance from the plan and the weight trend, and flags a phase mismatch", () => {
    const s = summarize(week([day(2400, 160), day(2400, 160), day(2400, 160), null, null, null, null]), "2026-10-12");
    // losing 0.5% of 80 kg per week = 0.4 kg/week ≈ 440 kcal/day below maintenance
    const cut = nutritionNotes(s, "cut", 80, -0.005);
    expect(cut.find(n => n.key === "why.nut.maintenance")!.params).toEqual({ kcal: 2400, m: 2850 });
    expect(cut.some(n => n.key === "why.nut.cutNotLosing")).toBe(false);
    expect(nutritionNotes(s, "bulk", 80, -0.005).some(n => n.key === "why.nut.bulkLosing")).toBe(true);
    expect(nutritionNotes(s, "cut", 80, 0.001).some(n => n.key === "why.nut.cutNotLosing")).toBe(true);
    expect(nutritionNotes(summarize(week([day(2400, 160)]), "2026-11-20"), "maintain", 80, null).some(n => n.key === "why.nut.stale")).toBe(true);
  });
});
