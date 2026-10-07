import type { Lang } from "../db/types";
import type { EquipmentId, Exercise, Muscle, Pattern } from "./types";

export interface Filters {
  query: string;
  muscles: Muscle[];
  equipment: EquipmentId[];
  patterns: Pattern[];
  favoritesOnly: boolean;
  /** Hide stretches/mobility/cardio unless asked for. */
  includeNonStrength: boolean;
}

export const emptyFilters: Filters = { query: "", muscles: [], equipment: [], patterns: [], favoritesOnly: false, includeNonStrength: false };

/** Lowercase, fold full-width forms, katakana -> hiragana so カール and かーる both match. */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if every char of `q` appears in order in `text` (cheap typo/abbreviation tolerance), with small gap budget. */
function subsequence(q: string, text: string): boolean {
  if (q.length < 4) return false;
  let i = 0, gaps = 0, last = -1;
  for (let k = 0; k < text.length && i < q.length; k++) {
    if (text[k] === q[i]) {
      if (last >= 0 && k - last > 1) gaps += k - last - 1;
      last = k; i++;
    }
  }
  return i === q.length && gaps <= Math.max(2, q.length / 2);
}

/** Levenshtein distance <= 1 on a single word (transposition counts as 1 edit step via two ops; fine for typos). */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const d: number[] = [];
    for (let k = 0; k < a.length && d.length <= 2; k++) if (a[k] !== b[k]) d.push(k);
    if (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]) return true; // adjacent swap
  }
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Score 0 = no match; higher is better. Searches both languages regardless of UI language. */
export function score(ex: Exercise, q: string, haystack: { en: string; ja: string }): number {
  if (!q) return 1;
  const words = q.split(" ");
  let total = 0;
  // Whole-phrase bonuses so "barbell squat" ranks "Barbell Squat" above "Barbell Full Squat".
  for (const field of [haystack.en, haystack.ja]) {
    if (field === q) { total += 30; break; }
    if (field.startsWith(q + " ") || field.startsWith(q)) { total += 10; break; }
    if (field.includes(q)) { total += 5; break; }
  }
  for (const w of words) {
    let best = 0;
    for (const field of [haystack.en, haystack.ja]) {
      if (field.startsWith(w)) best = Math.max(best, 5);
      else if (field.includes(` ${w}`)) best = Math.max(best, 4);
      else if (field.includes(w)) best = Math.max(best, 3);
      else if (field.split(" ").some(t => t.length >= 4 && w.length >= 4 && withinOneEdit(t, w))) best = Math.max(best, 2);
      else if (subsequence(w, field.replace(/ /g, ""))) best = Math.max(best, 1);
    }
    if (!best) return 0;
    total += best;
  }
  void ex;
  return total;
}

const haystackCache = new WeakMap<Exercise, { en: string; ja: string }>();
const hay = (ex: Exercise) => {
  let h = haystackCache.get(ex);
  if (!h) { h = { en: normalize(ex.name.en), ja: normalize(ex.name.ja) }; haystackCache.set(ex, h); }
  return h;
};

export interface SearchOptions {
  lang: Lang;
  favorites?: Set<string>;
  recent?: Map<string, string>;
  /** Equipment the user has; exercises needing anything else are hidden when set. */
  available?: Set<EquipmentId>;
}

/** Filter + rank. Empty query: recents first, then alphabetical in the UI language. */
export function searchExercises(all: Exercise[], f: Filters, o: SearchOptions): Exercise[] {
  const q = normalize(f.query);
  const rows: { ex: Exercise; s: number }[] = [];
  for (const ex of all) {
    if (!f.includeNonStrength && !q && ["stretching", "cardio"].includes(ex.category)) continue;
    if (f.muscles.length && !f.muscles.some(m => ex.primary.includes(m) || ex.secondary.includes(m))) continue;
    if (f.muscles.length && !ex.primary.some(m => f.muscles.includes(m)) && !q) continue;
    if (f.equipment.length && !ex.equipment.some(e => f.equipment.includes(e))) continue;
    if (f.patterns.length && !f.patterns.includes(ex.pattern)) continue;
    if (f.favoritesOnly && !o.favorites?.has(ex.id)) continue;
    if (o.available && !ex.equipment.every(e => o.available!.has(e))) continue;
    const s = score(ex, q, hay(ex));
    if (s) rows.push({ ex, s });
  }
  const collator = new Intl.Collator(o.lang === "ja" ? "ja" : "en");
  rows.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    const ra = o.recent?.get(a.ex.id), rb = o.recent?.get(b.ex.id);
    if (ra || rb) return (rb ?? "").localeCompare(ra ?? "");
    // Equal relevance: the shorter (more basic) name first, then alphabetical.
    return a.ex.name[o.lang].length - b.ex.name[o.lang].length || collator.compare(a.ex.name[o.lang], b.ex.name[o.lang]);
  });
  return rows.map(r => r.ex);
}

/** Equipment a user owns, by profile choice. Bodyweight is always available. */
export function equipmentFor(level: "home" | "bands" | "dumbbells" | "gym"): Set<EquipmentId> | undefined {
  switch (level) {
    case "gym": return undefined;
    case "home": return new Set<EquipmentId>(["bodyweight", "other"]);
    case "bands": return new Set<EquipmentId>(["bodyweight", "bands", "other"]);
    case "dumbbells": return new Set<EquipmentId>(["bodyweight", "dumbbell", "bench", "bands", "kettlebell", "other"]);
  }
}

/** Same primary muscle and movement pattern, user's equipment, closest fatigue; the exercise itself excluded. */
export function substitutes(all: Exercise[], ex: Exercise, available?: Set<EquipmentId>, limit = 8): Exercise[] {
  return all
    .filter(c => c.id !== ex.id && c.primary[0] === ex.primary[0] && c.pattern === ex.pattern && !["stretching", "cardio"].includes(c.category))
    .filter(c => !available || c.equipment.every(e => available.has(e)))
    .sort((a, b) => {
      const sharedA = a.equipment.filter(e => ex.equipment.includes(e)).length;
      const sharedB = b.equipment.filter(e => ex.equipment.includes(e)).length;
      return Math.abs(a.fatigue - ex.fatigue) - Math.abs(b.fatigue - ex.fatigue) || sharedB - sharedA || a.name.en.localeCompare(b.name.en);
    })
    .slice(0, limit);
}
