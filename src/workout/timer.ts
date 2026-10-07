/**
 * Rest timer as pure functions over timestamps (never a ticking counter), so it stays correct when the
 * page is throttled or the screen is locked: the remaining time is always computed from `endsAt`.
 */
export interface TimerState {
  /** Epoch ms when the countdown reaches zero; null when idle or paused. */
  endsAt: number | null;
  /** Remaining ms while paused. */
  pausedMs: number | null;
  /** Length of the current rest in seconds (for the progress bar). */
  totalSec: number;
  /** Set once the alert has fired for this countdown. */
  alerted: boolean;
}

export const idle: TimerState = { endsAt: null, pausedMs: null, totalSec: 0, alerted: false };

export const start = (now: number, sec: number): TimerState => ({ endsAt: now + sec * 1000, pausedMs: null, totalSec: sec, alerted: false });

export const isRunning = (s: TimerState) => s.endsAt !== null;
export const isPaused = (s: TimerState) => s.pausedMs !== null;
export const isActive = (s: TimerState) => isRunning(s) || isPaused(s);

export function remainingMs(s: TimerState, now: number): number {
  if (s.pausedMs !== null) return s.pausedMs;
  if (s.endsAt !== null) return Math.max(0, s.endsAt - now);
  return 0;
}

export const remainingSec = (s: TimerState, now: number) => Math.ceil(remainingMs(s, now) / 1000);

export function pause(s: TimerState, now: number): TimerState {
  return s.endsAt === null ? s : { ...s, endsAt: null, pausedMs: remainingMs(s, now) };
}

export function resume(s: TimerState, now: number): TimerState {
  return s.pausedMs === null ? s : { ...s, endsAt: now + s.pausedMs, pausedMs: null };
}

/** +15 s / -15 s. Going to zero or below finishes the rest; the bar's total grows with additions. */
export function adjust(s: TimerState, now: number, deltaSec: number): TimerState {
  if (!isActive(s)) return s;
  const left = remainingMs(s, now) + deltaSec * 1000;
  const totalSec = Math.max(s.totalSec, Math.ceil(left / 1000));
  return s.pausedMs !== null ? { ...s, pausedMs: Math.max(0, left), totalSec } : { ...s, endsAt: now + Math.max(0, left), totalSec, alerted: left > 0 ? false : s.alerted };
}

export const skip = (): TimerState => idle;

/** True exactly once when a running countdown has reached zero. */
export function shouldAlert(s: TimerState, now: number): boolean {
  return s.endsAt !== null && !s.alerted && now >= s.endsAt;
}

export const markAlerted = (s: TimerState): TimerState => ({ ...s, alerted: true });

/** Progress 0..1 for the bar. */
export function progress(s: TimerState, now: number): number {
  if (!isActive(s) || s.totalSec <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(s, now) / (s.totalSec * 1000)));
}

export const MAX_RECENT = 5;

/** Most-recent-first list of custom rest times, de-duplicated and capped at five. */
export function pushRecent(list: readonly number[], sec: number): number[] {
  return [sec, ...list.filter(x => x !== sec)].slice(0, MAX_RECENT);
}

export const removeRecent = (list: readonly number[], sec: number): number[] => list.filter(x => x !== sec);

export const PRESETS = [90, 120] as const;

/** Parse "1:30", "90", "2m", "1m30" style input to seconds; null when unusable. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  let sec: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):(\d{1,2})$/))) sec = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = s.match(/^(\d+)\s*m(?:in)?\s*(\d+)?\s*s?$/))) sec = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = s.match(/^(\d+)\s*s?$/))) sec = Number(m[1]);
  if (sec === null || !Number.isFinite(sec) || sec < 5 || sec > 3600) return null;
  return sec;
}
