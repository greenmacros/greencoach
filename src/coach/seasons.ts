import type { Lang } from "../db/types";

/**
 * Seasonal and calendar context as a small readable table (not logic). First matching row per kind wins for
 * season; every matching `disruption` row is reported. Months are 1-12; ranges may wrap the year end.
 */
export type Region = "JP" | "north" | "south";

export interface SeasonRule {
  id: string;
  regions: Region[];
  /** Inclusive month range [from, to]; from > to wraps (e.g. 12-2). */
  months: [number, number];
  /** Extra seconds added to rest times. */
  restAddSec: number;
  /** Multiplier on MRV. */
  mrvMult: number;
  /** Multiplier on the performance-drop thresholds (performance is expected to dip, so be lenient). */
  perfTolerance: number;
  /** Message keys (see i18n) shown as notes. */
  notes: string[];
}

export const SEASONS: SeasonRule[] = [
  { id: "jp-summer", regions: ["JP"], months: [6, 9], restAddSec: 15, mrvMult: 0.95, perfTolerance: 2, notes: ["season.hot", "season.hydrate"] },
  { id: "jp-winter", regions: ["JP"], months: [12, 2], restAddSec: 0, mrvMult: 1, perfTolerance: 1, notes: ["season.cold", "season.mobility"] },
  { id: "north-summer", regions: ["north"], months: [6, 8], restAddSec: 15, mrvMult: 0.95, perfTolerance: 2, notes: ["season.hot", "season.hydrate"] },
  { id: "north-winter", regions: ["north"], months: [12, 2], restAddSec: 0, mrvMult: 1, perfTolerance: 1, notes: ["season.cold", "season.mobility"] },
  { id: "south-summer", regions: ["south"], months: [12, 2], restAddSec: 15, mrvMult: 0.95, perfTolerance: 2, notes: ["season.hot", "season.hydrate"] },
  { id: "south-winter", regions: ["south"], months: [6, 8], restAddSec: 0, mrvMult: 1, perfTolerance: 1, notes: ["season.cold", "season.mobility"] },
];

export interface Disruption {
  id: string;
  regions: Region[];
  /** [month, day] inclusive start and end; start > end wraps the year end. */
  from: [number, number];
  to: [number, number];
  note: string;
}

export const DISRUPTIONS: Disruption[] = [
  { id: "golden-week", regions: ["JP"], from: [4, 29], to: [5, 5], note: "disrupt.goldenWeek" },
  { id: "obon", regions: ["JP"], from: [8, 13], to: [8, 16], note: "disrupt.obon" },
  { id: "new-year-jp", regions: ["JP"], from: [12, 29], to: [1, 3], note: "disrupt.newYear" },
  { id: "new-year", regions: ["north", "south"], from: [12, 24], to: [1, 2], note: "disrupt.holidays" },
];

export const inMonthRange = (month: number, [from, to]: [number, number]) => (from <= to ? month >= from && month <= to : month >= from || month <= to);

const md = (m: number, d: number) => m * 100 + d;
export const inDayRange = (month: number, day: number, from: [number, number], to: [number, number]) => {
  const v = md(month, day), a = md(...from), b = md(...to);
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};

/** The season that applies to a local day key (YYYY-MM-DD) in a region, or null. */
export function seasonFor(dayKey: string, region: Region): SeasonRule | null {
  const month = Number(dayKey.slice(5, 7));
  return SEASONS.find(s => s.regions.includes(region) && inMonthRange(month, s.months)) ?? null;
}

/** Disruption rows that touch any day of the 7-day week starting at `weekStart`. */
export function disruptionsIn(weekStartKey: string, region: Region): Disruption[] {
  const out: Disruption[] = [];
  const base = new Date(Number(weekStartKey.slice(0, 4)), Number(weekStartKey.slice(5, 7)) - 1, Number(weekStartKey.slice(8, 10)), 12);
  for (const d of DISRUPTIONS) {
    if (!d.regions.includes(region)) continue;
    for (let i = 0; i < 7; i++) {
      const day = new Date(base.getTime() + i * 86_400_000);
      if (inDayRange(day.getMonth() + 1, day.getDate(), d.from, d.to)) { out.push(d); break; }
    }
  }
  return out;
}

export type { Lang };
