import { describe, expect, it } from "vitest";
import type { Exercise } from "../library/types";
import { TEMPLATES, instantiateTemplate } from "./templates";
import { codeFromHash, decodePlan, encodePlan, fromShared, shareUrl, toShared } from "./share";
import type { Program } from "./types";

const example = (): Program => ({
  ...instantiateTemplate(TEMPLATES.find(t => t.id === "example-4")!, "ja", "2026-10-07"),
  id: "prog:x", createdAt: "", updatedAt: "", schemaVersion: 1,
});
const none = () => undefined;

describe("sharing a plan by link", () => {
  it("round-trips a program: sessions, schedule, sets, reps, notes", async () => {
    const p = example();
    const code = await encodePlan(toShared(p, none));
    const back = fromShared(await decodePlan(code), "2026-10-14", new Map());
    expect(back.name).toBe(p.name);
    expect(back.sessions.map(s => s.name)).toEqual(p.sessions.map(s => s.name));
    const strip = (x: Pick<Program, "sessions">) => x.sessions.map(s => s.exercises.map(e => [e.exerciseId, e.sets, e.repMin, e.repMax, e.rir, e.restSec, e.notes]));
    expect(strip(back)).toEqual(strip(p));
    expect(back.week.map(id => back.sessions.findIndex(s => s.id === id))).toEqual(p.week.map(id => p.sessions.findIndex(s => s.id === id)));
    expect(back.mesoStartDayKey).toBe("2026-10-12");
    expect(back.sessions[0].exercises.every(e => e.weightKg === null)).toBe(true);
  });

  it("keeps links short enough to paste anywhere", async () => {
    const code = await encodePlan(toShared(example(), none));
    expect(shareUrl(code, "https://greenmacros.github.io/greencoach/").length).toBeLessThan(4000);
    expect(codeFromHash("#plan=" + code)).toBe(code);
    expect(codeFromHash("#other")).toBeNull();
  });

  it("carries custom exercises and maps them to new local ids", async () => {
    const p = example();
    p.sessions[0].exercises[0].exerciseId = "custom:abc";
    const lookup = (id: string): Exercise | undefined => id === "custom:abc"
      ? { id, name: { en: "My Row", ja: "マイロウ" }, primary: ["lats"], secondary: [], equipment: ["cable"], pattern: "h-pull", mechanic: "compound", difficulty: 1, fatigue: 2, category: "custom", joints: [], frames: 0, custom: true, notes: "slow" }
      : undefined;
    const plan = await decodePlan(await encodePlan(toShared(p, lookup)));
    expect(plan.c).toHaveLength(1);
    expect(plan.c![0]).toMatchObject({ en: "My Row", ja: "マイロウ", p: ["lats"], eq: ["cable"] });
    const back = fromShared(plan, "2026-10-14", new Map([["custom:abc", "custom:new"]]));
    expect(back.sessions[0].exercises[0].exerciseId).toBe("custom:new");
  });

  it("rejects damaged or hostile links and clamps silly numbers", async () => {
    await expect(decodePlan("zz@@")).rejects.toThrow("bad-plan");
    await expect(decodePlan("j" + btoa("not json"))).rejects.toThrow("bad-plan");
    await expect(decodePlan("j" + btoa(JSON.stringify({ v: 2 })))).rejects.toThrow("bad-plan");
    const odd = { v: 1, n: "x", a: 99, w: [0, 5, -1, null, "a", 0, 0], s: [{ n: "A", e: [["Leg_Press", 500, 20, 5, -3, 99999, 7, "x"]] }] };
    const plan = await decodePlan("j" + btoa(JSON.stringify(odd)));
    expect(plan.a).toBe(8);
    expect(plan.w).toEqual([0, null, null, null, null, 0, 0]);
    expect(plan.s[0].e[0]).toEqual(["Leg_Press", 20, 20, 20, 0, 900, "", 0]);
  });
});
