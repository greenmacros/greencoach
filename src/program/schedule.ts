import { MESO_MAX, MESO_MIN, type DayOverride, type Program, type SessionTemplate } from "./types";

const p2 = (n: number) => String(n).padStart(2, "0");

/** Parse a YYYY-MM-DD key as a local date at noon (immune to DST edges). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** The training day a moment belongs to, honoring "day starts at N:00". */
export function trainingDayKey(now: Date, dayStartHour: number): string {
  return dateToKey(new Date(now.getTime() - dayStartHour * 3_600_000));
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateToKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((keyToDate(b).getTime() - keyToDate(a).getTime()) / 86_400_000);
}

/** Monday = 0 .. Sunday = 6. */
export function weekdayIndex(key: string): number {
  return (keyToDate(key).getDay() + 6) % 7;
}

export const weekStart = (key: string) => addDays(key, -weekdayIndex(key));
export const weekDays = (key: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(key), i));

export type DayStatus = "planned" | "rest" | "skipped" | "done";

export interface ResolvedDay {
  dayKey: string;
  /** The session due on this day (null = rest). A skipped day keeps its session. */
  sessionId: string | null;
  status: DayStatus;
  /** What the weekly template says, ignoring one-off changes. */
  baseSessionId: string | null;
  overridden: boolean;
}

export function resolveDay(
  program: Program,
  overrides: ReadonlyMap<string, DayOverride>,
  dayKey: string,
  completed: ReadonlySet<string> = new Set(),
): ResolvedDay {
  const base = program.week[weekdayIndex(dayKey)] ?? null;
  const ovr = overrides.get(dayKey);
  const sessionId = ovr ? ovr.sessionId : base;
  const known = sessionId && program.sessions.some(s => s.id === sessionId) ? sessionId : null;
  let status: DayStatus = known ? "planned" : "rest";
  if (known && ovr?.skipped) status = "skipped";
  if (completed.has(dayKey)) status = "done";
  return { dayKey, sessionId: known, status, baseSessionId: base, overridden: !!ovr };
}

/** An override patch the caller persists. `clear` means "delete the override record for that day". */
export type OverridePatch = { dayKey: string; clear: true } | { dayKey: string; sessionId: string | null; skipped: boolean };

const same = (program: Program, dayKey: string, sessionId: string | null, skipped: boolean): OverridePatch =>
  sessionId === (program.week[weekdayIndex(dayKey)] ?? null) && !skipped ? { dayKey, clear: true } : { dayKey, sessionId, skipped };

export function skipPatch(day: ResolvedDay): OverridePatch[] {
  return day.sessionId ? [{ dayKey: day.dayKey, sessionId: day.sessionId, skipped: true }] : [];
}

export function unskipPatch(program: Program, day: ResolvedDay): OverridePatch[] {
  return [same(program, day.dayKey, day.sessionId, false)];
}

/**
 * "Move Push to tomorrow": the source day becomes rest and the target takes the session.
 * If the target already has a session the two days swap, so the week never loses a session.
 */
export function movePatch(program: Program, from: ResolvedDay, to: ResolvedDay): OverridePatch[] {
  if (from.dayKey === to.dayKey || !from.sessionId) return [];
  return [
    same(program, to.dayKey, from.sessionId, false),
    same(program, from.dayKey, to.sessionId, false),
  ];
}

export interface MesoPosition {
  /** 1-based week within the current mesocycle. */
  week: number;
  total: number;
  isDeload: boolean;
  /** Which mesocycle (1-based) we are in, counting automatic restarts. */
  cycle: number;
  started: boolean;
}

export function mesoPosition(program: Pick<Program, "accumulationWeeks" | "mesoStartDayKey">, dayKey: string): MesoPosition {
  const acc = Math.min(MESO_MAX, Math.max(MESO_MIN, program.accumulationWeeks));
  const total = acc + 1;
  const weeksSince = Math.floor(daysBetween(weekStart(program.mesoStartDayKey), weekStart(dayKey)) / 7);
  const started = weeksSince >= 0;
  const idx = started ? weeksSince : 0;
  const week = (idx % total) + 1;
  return { week, total, isDeload: week === total, cycle: Math.floor(idx / total) + 1, started };
}

/** Rough session length: ~45 s of work per set plus rest between sets. */
export function estimateMinutes(session: SessionTemplate): number {
  let sec = 0;
  for (const s of session.exercises) sec += s.sets * 45 + Math.max(0, s.sets - 1) * s.restSec + 30;
  return Math.max(1, Math.round(sec / 60 / 5) * 5);
}

export function totalSets(session: SessionTemplate): number {
  return session.exercises.reduce((n, s) => n + s.sets, 0);
}

/** 1-based number of this training day within its week ("Day 3"), from the weekly template. */
export function trainingDayNumber(program: Pick<Program, "week">, dayKey: string): number {
  const idx = weekdayIndex(dayKey);
  const n = program.week.slice(0, idx + 1).filter(Boolean).length;
  return Math.max(1, n);
}
