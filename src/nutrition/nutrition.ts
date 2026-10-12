import { daysBetween } from "../program/schedule";
import { dayKey } from "../lib/id";

/**
 * A planned week from GreenMacros (the sister nutrition planner). Only daily totals travel:
 * days[i] = [kcal, protein g, carbs g, fat g] for Mon..Sun, null where no plan is assigned.
 * It is what the user plans to eat, not a food log, and every message says so.
 */
export interface NutritionPlan {
  v: 1;
  src: "greenmacros";
  /** When it was sent from GreenMacros. */
  at: string;
  days: ([number, number, number, number] | null)[];
  targets: ([number, number, number, number] | null)[];
}

export const NUTRITION_KEY = "nutrition=";
export const GREENMACROS_URL = "https://green-macros.vercel.app/";

const num = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : null);
const quad = (x: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(x) || x.length < 4) return null;
  const [k, p, c, f] = [num(x[0], 20000), num(x[1], 1000), num(x[2], 3000), num(x[3], 1000)];
  return k === null || p === null || c === null || f === null ? null : [k, p, c, f];
};

/** Decode and validate an untrusted code (the part after "#nutrition="). Throws Error("bad-nutrition"). */
export function decodeNutrition(code: string): NutritionPlan {
  let d: Partial<NutritionPlan> | null;
  try {
    const bin = atob(code.trim().replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.trim().length + 3) % 4));
    d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch { throw new Error("bad-nutrition"); }
  if (!d || d.v !== 1 || d.src !== "greenmacros" || !Array.isArray(d.days) || typeof d.at !== "string" || Number.isNaN(Date.parse(d.at))) throw new Error("bad-nutrition");
  const days = Array.from({ length: 7 }, (_, i) => quad(d!.days![i]));
  if (!days.some(Boolean)) throw new Error("bad-nutrition");
  const targets = Array.from({ length: 7 }, (_, i) => quad(Array.isArray(d!.targets) ? d!.targets[i] : null));
  return { v: 1, src: "greenmacros", at: new Date(d.at).toISOString(), days, targets };
}

/** The code inside a pasted link or message ("…#nutrition=CODE"), or null. */
export function nutritionCodeFrom(text: string): string | null {
  const i = text.indexOf("#" + NUTRITION_KEY);
  const code = i >= 0 ? text.slice(i + 1 + NUTRITION_KEY.length) : text.startsWith(NUTRITION_KEY) ? text.slice(NUTRITION_KEY.length) : "";
  const m = code.match(/^[A-Za-z0-9_-]+/);
  return m ? m[0] : null;
}

export interface NutritionSummary { plannedDays: number; kcal: number; protein: number; carbs: number; fat: number; ageDays: number }

/** Daily averages over the days that have a plan. */
export function summarize(n: NutritionPlan, today = dayKey(new Date())): NutritionSummary {
  const ds = n.days.filter((d): d is [number, number, number, number] => d !== null);
  const avg = (i: number) => ds.reduce((s, d) => s + d[i], 0) / Math.max(1, ds.length);
  return { plannedDays: ds.length, kcal: avg(0), protein: avg(1), carbs: avg(2), fat: avg(3), ageDays: Math.max(0, daysBetween(n.at.slice(0, 10), today)) };
}

/** Protein that supports muscle growth: about 1.6 g per kg body weight per day (higher on a cut). */
export const PROTEIN_GOOD_PER_KG = 1.6;
export const PROTEIN_CUT_PER_KG = 1.8;
const KCAL_PER_KG = 7700;
export const NUTRITION_STALE_DAYS = 28;

export interface NutritionNote { kind: "info" | "warn" | "good"; key: string; params: Record<string, string | number> }

/**
 * What the coach says about a planned week. `rate` is the smoothed body-weight change as a fraction per week
 * (null without enough weigh-ins); `bodyKg` the latest body weight.
 */
export function nutritionNotes(s: NutritionSummary, phase: "bulk" | "cut" | "maintain", bodyKg: number | null, rate: number | null): NutritionNote[] {
  const out: NutritionNote[] = [];
  if (s.ageDays > NUTRITION_STALE_DAYS) out.push({ kind: "info", key: "why.nut.stale", params: { days: s.ageDays } });
  if (bodyKg) {
    const perKg = s.protein / bodyKg;
    const need = phase === "cut" ? PROTEIN_CUT_PER_KG : PROTEIN_GOOD_PER_KG;
    const p = { g: Math.round(s.protein), perKg: Math.round(perKg * 10) / 10, need, target: Math.round(need * bodyKg) };
    out.push(perKg < need ? { kind: "warn", key: "why.nut.proteinLow", params: p } : { kind: "good", key: "why.nut.proteinOk", params: p });
  }
  if (bodyKg && rate !== null && s.plannedDays >= 3) {
    const dailyEnergy = (rate * bodyKg * KCAL_PER_KG) / 7; // > 0: storing energy
    const maintenance = Math.round((s.kcal - dailyEnergy) / 50) * 50;
    out.push({ kind: "info", key: "why.nut.maintenance", params: { kcal: Math.round(s.kcal), m: maintenance } });
    if (phase === "bulk" && rate < -0.0025) out.push({ kind: "warn", key: "why.nut.bulkLosing", params: { m: maintenance } });
    if (phase === "cut" && rate > -0.0025) out.push({ kind: "warn", key: "why.nut.cutNotLosing", params: { m: maintenance } });
  }
  return out;
}
