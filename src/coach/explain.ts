import type { TFn } from "../i18n/translate";
import type { Reason } from "./types";

/** Turn a coach Reason into one translated sentence. Muscle ids in params become translated muscle names. */
export function explain(r: Reason, t: TFn): string {
  const params: Record<string, string | number> = { ...(r.params ?? {}) };
  if (typeof params.muscle === "string") params.muscle = t(`muscle.${params.muscle}`);
  if (typeof params.muscles === "string") params.muscles = params.muscles.split(", ").map(m => t(`muscle.${m}`)).join(", ");
  return t(r.key, params);
}
