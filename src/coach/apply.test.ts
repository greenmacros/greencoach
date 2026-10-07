import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { MESSAGES } from "../i18n/messages";
import { addDays } from "../program/schedule";
import { applyDecisions, isNoChange, toRecords, type Decision } from "./apply";
import { rejectionsFrom } from "./records";
import { BENCH, SQUAT, history, run, slotFor, standardProgram, week, workout } from "./fixtures";
import { DISRUPTIONS, SEASONS } from "./seasons";

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });

describe("coach explanations", () => {
  it("every explanation key the engine can emit has English and Japanese text", () => {
    const keys = new Set<string>();
    for (const f of readdirSync("src/coach").filter(f => f.endsWith(".ts") && !f.includes("test") && f !== "fixtures.ts"))
      for (const m of readFileSync(`src/coach/${f}`, "utf8").matchAll(/["'`](why\.[a-zA-Z0-9.]+)["'`]/g)) keys.add(m[1]);
    for (const s of SEASONS) for (const n of s.notes) keys.add(`why.${n}`);
    for (const d of DISRUPTIONS) keys.add(`why.${d.note}`);
    expect(keys.size).toBeGreaterThan(50);
    const msgs = MESSAGES as Record<string, { en: string; ja: string }>;
    const missing = [...keys].filter(k => !msgs[k]?.en || !msgs[k]?.ja);
    expect(missing).toEqual([]);
  });

  it("placeholders match between English and Japanese", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const [k, v] of Object.entries(MESSAGES as Record<string, { en: string; ja: string }>)) if (k.startsWith("why.")) expect(ph(v.ja), k).toEqual(ph(v.en));
  });
});

describe("applying a plan", () => {
  const base = () => {
    const prog = standardProgram();
    const plan = run(all, { program: prog, workouts: history([{ ex: BENCH, sets: [[80, 10, 2], [80, 10, 2], [80, 10, 2]], target: { repMin: 6, repMax: 10, rir: 2 } }]) });
    return { prog, plan };
  };

  it("writes accepted suggestions into the program and leaves rejected ones alone", () => {
    const { prog, plan } = base();
    const benchSlot = prog.sessions[0].exercises[0].id;
    const rowSlot = prog.sessions[0].exercises[2].id;
    const out = applyDecisions(prog, plan, new Map<string, Decision>([[benchSlot, { status: "accepted" }], [rowSlot, { status: "rejected" }]]));
    const b = out.sessions[0].exercises[0];
    expect(b.weightKg).toBe(82.5);
    expect(b.repMin).toBe(6);
    expect(out.sessions[0].exercises[2]).toEqual(prog.sessions[0].exercises[2]);
    expect(prog.sessions[0].exercises[0].weightKg).toBeUndefined(); // input untouched
  });

  it("edited values win over the proposal", () => {
    const { prog, plan } = base();
    const slot = prog.sessions[0].exercises[0].id;
    const out = applyDecisions(prog, plan, new Map([[slot, { status: "edited", values: { weightKg: 81, sets: 4 } } as Decision]]));
    expect(out.sessions[0].exercises[0]).toMatchObject({ weightKg: 81, sets: 4 });
  });

  it("an accepted swap replaces the exercise and clears the remembered weight", () => {
    const { prog, plan } = base();
    const slot = prog.sessions[0].exercises[0].id;
    const out = applyDecisions(prog, plan, new Map([[slot, { status: "accepted", swapTo: INCLINE_ID } as Decision]]));
    expect(out.sessions[0].exercises[0].exerciseId).toBe(INCLINE_ID);
    expect(out.sessions[0].exercises[0].weightKg).toBeNull();
  });

  it("no decisions means no change at all", () => {
    const { prog, plan } = base();
    expect(applyDecisions(prog, plan, new Map())).toEqual(prog);
  });

  it("a first plan anchors the mesocycle to the planned week", () => {
    const prog = standardProgram({ mesoStartDayKey: "2026-01-05" });
    const plan = run(all, { program: prog });
    const out = applyDecisions(prog, plan, new Map([[prog.sessions[0].exercises[0].id, { status: "accepted" } as Decision]]));
    expect(out.mesoStartDayKey).toBe(plan.targetWeekStart);
  });

  it("an accepted early deload makes the planned week the mesocycle's deload week", () => {
    const f = (d: string, ex: string, w: number) => workout(d, [{ ex, sets: [[w, 8, 2], [w, 8, 2], [w, 8, 2]] }], { sessionFatigue: 5 });
    const prog = standardProgram();
    const ws = [f(week(2), BENCH, 80), f(addDays(week(2), 3), SQUAT, 100), f(week(3), BENCH, 80), f(addDays(week(3), 3), SQUAT, 100)];
    const plan = run(all, { program: prog, today: addDays(week(3), 6), targetWeekStart: week(4), workouts: ws });
    expect(plan.deload.type).toBe("early");
    const out = applyDecisions(prog, plan, new Map([[prog.sessions[0].exercises[0].id, { status: "accepted" } as Decision]]));
    expect(out.mesoStartDayKey).toBe(addDays(week(4), -35)); // 5 accumulation weeks before the deload week
  });

  it("records every decision, and rejected ones keep the old values as final", () => {
    const { prog, plan } = base();
    const slot = prog.sessions[0].exercises[0].id;
    const recs = toRecords(plan, new Map<string, Decision>([[slot, { status: "rejected" }]]), id => all.find(e => e.id === id)!.primary[0]);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ status: "rejected", muscle: "chest", slotId: slot });
    expect(recs[0].final.weightKg).toBe(80);
    expect(recs[0].proposed.weightKg).toBe(82.5);
  });

  it("a rejected raise becomes a remembered rejection; accepted ones do not", () => {
    const { prog, plan } = base();
    const slot = prog.sessions[0].exercises[0].id;
    const mk = (status: "rejected" | "accepted") => toRecords(plan, new Map<string, Decision>([[slot, { status }]]), id => all.find(e => e.id === id)!.primary[0]).map(r => ({ ...r, createdAt: "", updatedAt: "", schemaVersion: 1 }));
    expect(rejectionsFrom(mk("rejected")).some(r => r.scope === "slot" && r.kind === "load" && r.id === slot)).toBe(true);
    expect(rejectionsFrom(mk("accepted"))).toEqual([]);
  });

  it("rejecting really does change the next plan (round trip)", () => {
    const { prog, plan } = base();
    const slot = prog.sessions[0].exercises[0].id;
    const recs = toRecords(plan, new Map<string, Decision>([[slot, { status: "rejected" }]]), id => all.find(e => e.id === id)!.primary[0]).map(r => ({ ...r, createdAt: "", updatedAt: "", schemaVersion: 1 }));
    const again = run(all, { program: prog, workouts: history([{ ex: BENCH, sets: [[80, 10, 2], [80, 10, 2], [80, 10, 2]], target: { repMin: 6, repMax: 10, rir: 2 } }]), rejections: rejectionsFrom(recs) });
    expect(slotFor(again, BENCH).next.weightKg).toBe(80);
  });

  it("isNoChange recognises an unchanged exercise", () => {
    const { plan } = base();
    const s = slotFor(plan, BENCH);
    expect(isNoChange(s)).toBe(false);
    expect(isNoChange({ ...s, next: { ...s.last, targetReps: s.last.repMin } })).toBe(true);
  });
});

const INCLINE_ID = "Incline_Dumbbell_Press";
