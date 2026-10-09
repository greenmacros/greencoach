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

/** Rough strength of a band combination: the sum of the package kg. Null unless every band in it has a kg. */
export function bandStrength(ids: readonly string[] | null | undefined, all: readonly { id: string; kg?: number | null }[]): number | null {
  if (!ids?.length) return null;
  let sum = 0;
  for (const id of ids) {
    const kg = all.find(b => b.id === id)?.kg;
    if (kg == null) return null;
    sum += kg;
  }
  return sum;
}

/**
 * The lightest single band, pair or trio that is stronger than `ids` (by package kg), for going past the heaviest
 * band or stepping up from a combination. Fewer bands win a tie. Null when kg values are missing or nothing is stronger.
 */
export function nextCombo(ids: readonly string[] | null | undefined, all: readonly { id: string; kg?: number | null }[]): string[] | null {
  const cur = bandStrength(ids, all);
  if (cur === null) return null;
  const known = all.filter(b => b.kg != null);
  const options: { ids: string[]; kg: number }[] = known.map(b => ({ ids: [b.id], kg: b.kg! }));
  for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) {
    options.push({ ids: [known[i].id, known[j].id], kg: known[i].kg! + known[j].kg! });
    for (let k = j + 1; k < known.length; k++) options.push({ ids: [known[i].id, known[j].id, known[k].id], kg: known[i].kg! + known[j].kg! + known[k].kg! });
  }
  const better = options.filter(o => o.kg > cur + 1e-9).sort((a, b) => a.kg - b.kg || a.ids.length - b.ids.length);
  return better[0]?.ids ?? null;
}

/**
 * Rep ranges used once no stronger band is left: 10-15 → 15-20 → 20-30. Sets taken close to failure keep building
 * muscle up to roughly 30 reps (lighter loads grow muscle about as well as heavy ones when sets end near failure),
 * so 30 is the ceiling. Returns null at the ceiling.
 */
export const BAND_REP_CEILING = 30;
/** Same ladder for any load that cannot go up (heaviest band, heaviest dumbbell). */
export function nextBandRange(hi: number): { min: number; max: number } | null {
  if (hi >= BAND_REP_CEILING) return null;
  const max = [15, 20, BAND_REP_CEILING].find(x => x > hi) ?? BAND_REP_CEILING;
  return { min: Math.min(hi, max - 5), max };
}

/** One band up: the next band in the user's order, or, past the heaviest band (or from a combination), the next combination by kg. */
export const stepUp = (ids: readonly string[] | null | undefined, all: readonly { id: string; kg?: number | null }[]): string[] | null => {
  const next = nextBand(ids, all);
  return next ? [next] : nextCombo(ids, all);
};

/** Pairs of neighbouring bands whose kg contradicts the order (a later band is lighter), for a gentle warning. */
export function orderConflicts(all: readonly Band[]): [Band, Band][] {
  const out: [Band, Band][] = [];
  let prev: Band | null = null;
  for (const b of all) {
    if (b.kg == null) continue;
    if (prev && b.kg < prev.kg!) out.push([prev, b]);
    prev = b;
  }
  return out;
}

/** The same bands sorted lightest first by kg; bands without a kg keep their place relative to each other. */
export function sortByKg(all: readonly Band[]): Band[] {
  const withKg = all.filter(b => b.kg != null).sort((a, b) => a.kg! - b.kg!);
  let k = 0;
  return all.map(b => (b.kg == null ? b : withKg[k++]));
}
