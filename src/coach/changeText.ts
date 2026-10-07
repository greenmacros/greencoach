import type { WeightUnit } from "../db/types";
import type { TFn } from "../i18n/translate";
import { fmtWeight, formatRest } from "../lib/format";
import type { AutoChange } from "./auto";

/** Changes to sets, weight or reps: the ones worth a line of their own. */
export const isMajor = (c: AutoChange) =>
  c.before.sets !== c.after.sets || c.before.repMin !== c.after.repMin || c.before.repMax !== c.after.repMax ||
  (c.after.weightKg != null && c.before.weightKg !== c.after.weightKg);

export interface ChangePart { text: string; dir: "up" | "down" }

/**
 * Short "what changed" pieces for one exercise, e.g. "▲ 3→4 sets", "▲ 60→62.5 kg".
 * `minor` adds RIR and rest changes, which usually move for many exercises at once and are summarised separately.
 */
export function changeParts(c: AutoChange, unit: WeightUnit, t: TFn, minor = false): ChangePart[] {
  const a = c.before, b = c.after, out: ChangePart[] = [];
  const dir = (x: number, y: number): ChangePart["dir"] => (y > x ? "up" : "down");
  if (a.sets !== b.sets) out.push({ text: t("auto.sets", { a: a.sets, b: b.sets }), dir: dir(a.sets, b.sets) });
  if (b.weightKg != null && a.weightKg !== b.weightKg)
    out.push({ text: a.weightKg == null ? `${fmtWeight(b.weightKg, unit)} ${unit}` : `${fmtWeight(a.weightKg, unit)}→${fmtWeight(b.weightKg, unit)} ${unit}`, dir: dir(a.weightKg ?? 0, b.weightKg) });
  if (a.repMin !== b.repMin || a.repMax !== b.repMax)
    out.push({ text: t("auto.reps", { a: `${a.repMin}-${a.repMax}`, b: `${b.repMin}-${b.repMax}` }), dir: dir(a.repMax, b.repMax) });
  if (!minor) return out;
  if (a.rir !== b.rir) out.push({ text: t("auto.rir", { a: a.rir, b: b.rir }), dir: dir(a.rir, b.rir) });
  if (a.restSec !== b.restSec) out.push({ text: t("auto.rest", { a: formatRest(a.restSec), b: formatRest(b.restSec) }), dir: dir(a.restSec, b.restSec) });
  return out;
}
