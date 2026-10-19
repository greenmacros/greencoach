import type { WeightUnit } from "../db/types";
import { KG_PER_LB } from "../lib/format";

/**
 * How the user's dumbbells step. Dumbbells are fixed weights, so the coach only suggests ones that exist.
 * "mixed": 1 kg steps up to 10 kg, then 2 kg (common in Japanese gyms). A number: one step size in kg everywhere.
 */
export type DumbbellSteps = "mixed" | number;

export const DUMBBELL_STEP_CHOICES: Record<WeightUnit, DumbbellSteps[]> = {
  kg: ["mixed", 1, 2, 2.5],
  lb: [2.5 * KG_PER_LB, 5 * KG_PER_LB],
};

/** Every dumbbell weight (kg) on the user's rack, lightest first, up to their heaviest (no heaviest set: 100 kg). */
export function dumbbellRack(s: DumbbellSteps, maxKg?: number | null): number[] {
  const top = maxKg ?? 100;
  const out: number[] = [];
  if (s === "mixed") {
    for (let w = 1; w <= Math.min(10, top) + 1e-9; w += 1) out.push(w);
    for (let w = 12; w <= top + 1e-9; w += 2) out.push(w);
  } else {
    for (let w = s; w <= top + 1e-9; w += s) out.push(Math.round(w * 1000) / 1000);
  }
  if (maxKg && !out.some(w => Math.abs(w - maxKg) < 1e-6)) out.push(maxKg);
  return out.sort((a, b) => a - b);
}

/** The rack weight nearest to `w` (ties go to the lighter one). */
export function nearestOnRack(rack: readonly number[], w: number): number {
  let best = rack[0];
  for (const x of rack) if (Math.abs(x - w) < Math.abs(best - w) - 1e-9) best = x;
  return best;
}

/** `steps` dumbbells up (or down, when negative) from the one nearest to `from`. */
export function stepOnRack(rack: readonly number[], from: number, steps: number): number {
  const i = rack.indexOf(nearestOnRack(rack, from));
  return rack[Math.max(0, Math.min(rack.length - 1, i + steps))];
}
