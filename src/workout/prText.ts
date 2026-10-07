import type { WeightUnit } from "../db/types";
import { fmtWeight } from "../lib/format";
import type { TFn } from "../i18n/translate";
import type { PR, PRKind } from "./pr";

/** A record's number as shown to the user (reps stay plain; weights convert to the chosen unit). */
export const prValueText = (kind: PRKind, raw: number, unit: WeightUnit): string =>
  kind === "reps" ? String(raw) : fmtWeight(Math.round(raw * 100) / 100, unit);

/** Human sentence for a PR, e.g. "Est. 1RM 120 kg". */
export const prText = (pr: Pick<PR, "kind" | "value">, unit: WeightUnit, t: TFn): string =>
  t(`pr.${pr.kind}`, { v: prValueText(pr.kind, pr.value, unit), u: unit });
