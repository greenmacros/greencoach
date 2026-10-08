import type { Lang } from "../db/types";
import type { Exercise } from "../library/types";

/**
 * One of the user's own resistance bands. Bands are logged by which band was used, not by kg: a band's pull changes
 * with stretch, anchor and brand, so the order (lightest first) is what progression uses. `kg` is optional and only
 * informative (what the package says).
 */
export interface Band { id: string; name: string; color: string; kg: number | null }

export const BAND_COLORS = ["#facc15", "#ef4444", "#22c55e", "#3b82f6", "#111827", "#a855f7", "#f97316", "#9ca3af"] as const;

const DEFAULT_NAMES: Record<Lang, string[]> = {
  en: ["Extra light", "Light", "Medium", "Heavy", "Extra heavy"],
  ja: ["エクストラライト", "ライト", "ミディアム", "ヘビー", "エクストラヘビー"],
};

/** Five common levels in the usual colour order; the user renames, recolours and reorders them. */
export const defaultBands = (lang: Lang): Band[] =>
  DEFAULT_NAMES[lang].map((name, i) => ({ id: `band-${i + 1}`, name, color: BAND_COLORS[i], kg: null }));

/** The user's bands, or the defaults until they edit them. */
export const bandsOf = (s: { bands?: Band[]; lang: Lang }): Band[] => s.bands ?? defaultBands(s.lang);

/** Exercises where a band is the resistance (not an add-on to a bar). */
export const isBandsOnly = (ex: Exercise) => ex.equipment.includes("bands") && ex.equipment.every(e => ["bands", "bodyweight", "other"].includes(e));

/** Bands in a set, lightest first, ignoring ids that are no longer in the list. */
export const bandsIn = (ids: readonly string[] | null | undefined, all: readonly Band[]): Band[] =>
  all.filter(b => ids?.includes(b.id));

export const bandLabel = (ids: readonly string[] | null | undefined, all: readonly Band[]): string =>
  bandsIn(ids, all).map(b => b.name).join(" + ");

/** Stable key for a band combination (order-independent). */
export const bandKey = (ids: readonly string[] | null | undefined): string => (ids?.length ? [...ids].sort().join("+") : "");

/**
 * The next band up from a single band; null when already on the heaviest band, for combinations, or when unknown.
 * Progression goes one band at a time; combining bands is left to the user.
 */
export function nextBand(ids: readonly string[] | null | undefined, order: readonly { id: string }[]): string | null {
  if (!ids || ids.length !== 1) return null;
  const i = order.findIndex(b => b.id === ids[0]);
  return i >= 0 && i < order.length - 1 ? order[i + 1].id : null;
}
