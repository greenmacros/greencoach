import { isBandsOnly } from "../bands/bands";
import type { Exercise } from "../library/types";

export type WeightKind = "weight" | "addWeight" | "assist" | "band";

/** What the weight column holds: loaded bodyweight moves add weight, assisted machines subtract it, bands use a picker. */
export function weightKind(ex: Exercise | undefined): WeightKind {
  if (!ex) return "weight";
  if (/assisted/i.test(ex.name.en)) return "assist";
  if (isBandsOnly(ex)) return "band";
  const bw = ex.equipment.every(e => ["bodyweight", "pullup-bar", "dip-bars", "bench", "trx"].includes(e));
  return bw ? "addWeight" : "weight";
}

/**
 * What the weight column means for this exercise, so logging stays consistent (the coach compares you with
 * yourself). Returns an i18n key under `wk.wt.*`, or null when the column is self-explanatory.
 */
export function weightHintKey(ex: Exercise | undefined): string | null {
  if (!ex) return null;
  const kind = weightKind(ex);
  if (kind === "assist") return "wk.wt.assist";
  if (kind === "band") return null; // band picker
  if (kind === "addWeight") return "wk.wt.added";
  const eq = ex.equipment;
  if (eq.includes("smith")) return "wk.wt.smith";
  if (eq.includes("landmine")) return "wk.wt.landmine";
  if (eq.includes("barbell") || eq.includes("ez-bar")) return "wk.wt.bar";
  if (eq.includes("machine") && /leg press|hack squat|leverage|lever|plate|t-bar|sled|pendulum|belt squat/i.test(ex.name.en)) return "wk.wt.plates";
  if (eq.includes("machine") || eq.includes("cable")) return "wk.wt.stack";
  if (eq.includes("dumbbell")) return "wk.wt.db";
  if (eq.includes("kettlebell")) return "wk.wt.kb";
  return null;
}
