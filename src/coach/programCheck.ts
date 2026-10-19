import { canDo } from "../library/equipment";
import type { EquipmentId, Exercise, Muscle } from "../library/types";
import { addDays, daysBetween, estimateMinutes, weekStart } from "../program/schedule";
import type { Program, SessionTemplate } from "../program/types";
import { exerciseIdsInTemplates } from "../program/templates";
import type { WorkoutLog } from "../workout/types";
import { COACH_CONFIG, type CoachConfig } from "./config";
import { plannedMuscleSets, weightedSets } from "./stats";
import type { CoachProfile } from "./types";
import { bandFor, type Modifiers } from "./volume";
import { seasonFor } from "./seasons";

/**
 * Program check: looks at the whole weekly plan (not at one week's progression) and points out what it can back up:
 * muscles below the volume that grows them (or below the growth range for focus muscles), muscles above what they can
 * recover from, too much pushing vs pulling, one muscle crowded into one session, and very long sessions.
 * Nothing is changed without the user: each finding carries a suggested action they can apply, change or ignore.
 * Safety: muscles with recent joint pain never get more work; suggested exercises fit the user's equipment, are not
 * Olympic, plyometric or strongman lifts, and match their experience.
 */

/** Muscles the check plans for. Small or indirectly trained ones (forearms, traps, neck, lower back…) are left out. */
export const CHECK_MUSCLES: Muscle[] = ["chest", "shoulders", "triceps", "biceps", "lats", "middle-back", "quadriceps", "hamstrings", "glutes", "calves"];
export const MAX_FOCUS = 3;
const LONG_SESSION_MIN = 90;
export const DISMISS_DAYS = 28;

export type Finding =
  | { id: string; kind: "under"; muscle: Muscle; sets: number; target: number; focus: boolean; sessionId: string; addSets: number; candidates: string[]; /** The day that trains it already has as much as one session can use. */ fullSessionId?: string }
  | { id: string; kind: "pain"; muscle: Muscle; sets: number; target: number }
  | { id: string; kind: "over"; muscle: Muscle; sets: number; mrv: number; sessionId: string; slotId: string; exerciseId: string; newSets: number }
  /** Over MRV but no single exercise can be trimmed (the volume comes from exercises that train it secondarily). */
  | { id: string; kind: "overNote"; muscle: Muscle; sets: number; mrv: number }
  | { id: string; kind: "balance"; push: number; pull: number; sessionId: string; addSets: number; candidates: string[] }
  | { id: string; kind: "crowded"; muscle: Muscle; sessionId: string; sets: number; cap: number }
  | { id: string; kind: "long"; sessionId: string; minutes: number };

export interface CheckInput {
  program: Program;
  all: readonly Exercise[];
  lookup: (id: string) => Exercise | undefined;
  profile: CoachProfile;
  focus: readonly Muscle[];
  have: ReadonlySet<EquipmentId>;
  workouts: readonly WorkoutLog[];
  today: string;
  /** Monday of the week the coach is planning (its season is used, so both agree on limits). Defaults to this week. */
  planWeekStart?: string;
  /** Finding ids the user ignored, with the day: asked again after DISMISS_DAYS. */
  dismissed?: Readonly<Record<string, string>>;
  config?: CoachConfig;
}

const PUSH = new Set(["h-push", "v-press"]);
const PULL = new Set(["h-pull", "v-pull"]);
const AVOID_CATEGORIES = new Set(["olympic weightlifting", "strongman", "plyometrics", "stretching", "cardio"]);
const AVOID_PATTERNS = new Set(["olympic", "plyo", "carry", "cardio", "mobility"]);

/** The week's sessions, each once, with how many days a week it runs (a set added to it counts that many times). */
function sessionsInWeek(p: Program): { s: SessionTemplate; times: number }[] {
  const out = new Map<string, { s: SessionTemplate; times: number }>();
  for (const id of p.week) {
    const s = p.sessions.find(x => x.id === id);
    if (s) out.set(s.id, { s, times: (out.get(s.id)?.times ?? 0) + 1 });
  }
  return [...out.values()];
}

let knownIds: Set<string> | null = null;
const known = () => (knownIds ??= new Set(exerciseIdsInTemplates()));

/** Muscles whose exercises had joint pain 2+ in the last three weeks: never add work there. */
export function painfulMuscles(workouts: readonly WorkoutLog[], lookup: CheckInput["lookup"], today: string): Set<Muscle> {
  const out = new Set<Muscle>();
  for (const w of workouts) {
    if (!w.finishedAt || daysBetween(w.dayKey, today) > 21) continue;
    for (const e of w.exercises) if ((e.jointPain ?? 0) >= 2) { const m = lookup(e.exerciseId)?.primary[0]; if (m) out.add(m); }
  }
  return out;
}

/** Up to `n` sensible exercises for a muscle (and optional movement patterns), best first. */
export function candidatesFor(args: { muscle?: Muscle; muscles?: readonly Muscle[]; patterns?: Set<string>; all: readonly Exercise[]; have: ReadonlySet<EquipmentId>; exclude: ReadonlySet<string>; maxDifficulty: number; preferIsolation: boolean; n?: number }): string[] {
  const k = known();
  return args.all
    .filter(e => (!args.muscle || e.primary[0] === args.muscle) && (!args.muscles || args.muscles.includes(e.primary[0])) && (!args.patterns || args.patterns.has(e.pattern)))
    .filter(e => !AVOID_CATEGORIES.has(e.category) && !AVOID_PATTERNS.has(e.pattern) && e.difficulty <= args.maxDifficulty && canDo(e, args.have) && !args.exclude.has(e.id))
    .sort((a, b) =>
      Number(k.has(b.id)) - Number(k.has(a.id)) ||            // well-known lifts first (they are in our templates)
      Number(b.frames > 0 || !!b.media) - Number(a.frames > 0 || !!a.media) || // then ones with a picture
      Number((b.mechanic === "isolation") === args.preferIsolation) - Number((a.mechanic === "isolation") === args.preferIsolation) ||
      a.fatigue - b.fatigue || a.name.en.localeCompare(b.name.en))
    .slice(0, args.n ?? 3)
    .map(e => e.id);
}

const UPPER = new Set<Muscle>(["chest", "shoulders", "triceps", "biceps", "forearms", "lats", "middle-back", "traps", "neck"]);
const LOWER = new Set<Muscle>(["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors", "lower-back"]);
const halfOf = (m: Muscle) => (UPPER.has(m) ? "upper" : LOWER.has(m) ? "lower" : null);
/** Which half of the body a session mostly trains (by weighted sets). */
function mainHalf(sets: ReadonlyMap<Muscle, number>): "upper" | "lower" | null {
  let up = 0, low = 0;
  for (const [m, n] of sets) { if (UPPER.has(m)) up += n; else if (LOWER.has(m)) low += n; }
  return up > low ? "upper" : low > up ? "lower" : null;
}

export function checkProgram(input: CheckInput): Finding[] {
  const cfg = input.config ?? COACH_CONFIG;
  const { program, profile, lookup } = input;
  // Same landmarks as the weekly coach, season included (for this week, as the coach picks it: mid-week), so the
  // two never disagree about "too much".
  const season = seasonFor(addDays(input.planWeekStart ?? weekStart(input.today), 3), profile.region);
  const mods: Modifiers = {
    cfg, exp: cfg.experience[profile.experience], goalMods: cfg.goal[profile.goal], phaseMods: cfg.phase[profile.phase],
    seasonMrv: season?.mrvMult ?? 1, perfTolerance: 1, experience: profile.experience, goal: profile.goal, phase: profile.phase,
  };
  const sessions = sessionsInWeek(program);
  if (!sessions.length) return [];
  const planned = plannedMuscleSets(program, lookup, cfg);
  const pain = painfulMuscles(input.workouts, lookup, input.today);
  const inProgram = new Set(program.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)));
  const maxDifficulty = profile.experience === "beginner" ? 1 : profile.experience === "intermediate" ? 2 : 3;
  const out: Finding[] = [];
  // Ignored findings are left out before anything else, so they neither show nor shape the others (session
  // minutes, the push/pull check).
  const dismissed = input.dismissed ?? {};
  const live = (id: string) => !dismissed[id] || daysBetween(dismissed[id], input.today) >= DISMISS_DAYS;
  const push2 = (f: Finding) => { if (live(f.id)) out.push(f); };

  // Where to add: the session with the fewest minutes so far, counting what earlier suggestions add, so several
  // suggestions spread over the week instead of piling onto one day.
  const minutes = new Map(sessions.map(x => [x.s.id, estimateMinutes(x.s)]));
  // Weighted sets per muscle in each session, kept up to date as suggestions reserve sets.
  const perMuscle = new Map(sessions.map(x => [x.s.id, weightedSets(x.s.exercises.map(e => ({ exercise: lookup(e.exerciseId), sets: e.sets })), cfg.secondaryWeight)]));
  // The per-session cap counts direct sets only: rows and pulldowns brush the rear delts, but that is not shoulder
  // work that crowds a session.
  const direct = (s: SessionTemplate) => weightedSets(s.exercises.map(e => ({ exercise: lookup(e.exerciseId), sets: e.sets })), 0);
  const directPer = new Map(sessions.map(x => [x.s.id, direct(x.s)]));
  /**
   * Where a muscle's new exercise goes: first a session that already trains it (a split keeps its logic: back work on
   * the back day), as long as it stays under ~75 minutes and the per-session cap. When that day is full, another day
   * of the same half of the body (chest on the back & shoulders day, not on leg day); only then the lightest session.
   * `full` names the day that trains it but has no room, so the suggestion can say why it goes elsewhere.
   */
  const bestFor = (muscles: readonly Muscle[], sets: number): { at: { s: SessionTemplate; times: number }; full?: string } => {
    const byMinutes = [...sessions].sort((a, b) => minutes.get(a.s.id)! - minutes.get(b.s.id)!);
    const trains = (x: { s: SessionTemplate }) => muscles.some(m => (perMuscle.get(x.s.id)!.get(m) ?? 0) >= 1);
    const roomy = (x: { s: SessionTemplate }) => minutes.get(x.s.id)! + sets * 2.5 <= 75;
    const fits = byMinutes.filter(x => trains(x) && roomy(x) && muscles.every(m => (directPer.get(x.s.id)!.get(m) ?? 0) + sets <= cfg.volume.sessionCap));
    if (fits[0]) return { at: fits[0] };
    const full = byMinutes.find(trains)?.s.id;
    const half = halfOf(muscles[0]);
    const same = half ? byMinutes.filter(x => !trains(x) && roomy(x) && mainHalf(perMuscle.get(x.s.id)!) === half) : [];
    return { at: same[0] ?? byMinutes[0], full };
  };
  /** Reserve the lightest session for a suggestion. Sets per session: a session that runs twice a week needs half. */
  const reserve = (at: { s: SessionTemplate; times: number }, sets: number) => {
    const perSession = Math.max(2, Math.ceil(sets / at.times));
    minutes.set(at.s.id, minutes.get(at.s.id)! + perSession * 2.5);
    return perSession;
  };

  for (const muscle of CHECK_MUSCLES) {
    const band = bandFor(muscle, mods);
    const sets = Math.round((planned.get(muscle) ?? 0) * 10) / 10;
    const focus = input.focus.includes(muscle);
    const target = focus ? band.mavLow : band.mev;
    if (sets > band.mrv) {
      // Trim the exercise that trains it most.
      const slots = sessions.flatMap(x => x.s.exercises.map(e => ({ s: x.s, times: x.times, e }))).filter(x => lookup(x.e.exerciseId)?.primary[0] === muscle).sort((a, b) => b.e.sets * b.times - a.e.sets * a.times);
      const top = slots[0];
      const cut = top ? Math.min(Math.ceil((sets - band.mrv) / top.times), top.e.sets - 2) : 0;
      if (top && cut > 0) push2({ id: `over:${muscle}`, kind: "over", muscle, sets, mrv: band.mrv, sessionId: top.s.id, slotId: top.e.id, exerciseId: top.e.exerciseId, newSets: top.e.sets - cut });
      else push2({ id: `overNote:${muscle}`, kind: "overNote", muscle, sets, mrv: band.mrv });
      continue;
    }
    const missing = Math.ceil(target - sets);
    if (missing < 2) continue; // within a set of the target: not worth a change
    if (pain.has(muscle)) { push2({ id: `pain:${muscle}`, kind: "pain", muscle, sets, target }); continue; }
    if (!live(`under:${muscle}`)) continue;
    const { at, full } = bestFor([muscle], Math.min(4, Math.max(2, missing)));
    // Into a session that is already long, quicker isolation work ranks first.
    const candidates = candidatesFor({ muscle, all: input.all, have: input.have, exclude: inProgram, maxDifficulty, preferIsolation: minutes.get(at.s.id)! > 60 });
    if (!candidates.length) continue;
    const perSession = reserve(at, Math.min(4, Math.max(2, missing)));
    out.push({ id: `under:${muscle}`, kind: "under", muscle, sets, target, focus, sessionId: at.s.id, addSets: perSession, candidates, ...(full && full !== at.s.id ? { fullSessionId: full } : {}) });
  }

  // Pushing vs pulling (shoulder health and posture): pulling should at least come close.
  const items = sessions.flatMap(x => x.s.exercises.map(e => ({ ex: lookup(e.exerciseId), sets: e.sets * x.times })));
  const push = items.filter(i => i.ex && PUSH.has(i.ex.pattern)).reduce((n, i) => n + i.sets, 0);
  const pull = items.filter(i => i.ex && PULL.has(i.ex.pattern)).reduce((n, i) => n + i.sets, 0);
  const backAlready = out.some(f => f.kind === "under" && (f.muscle === "lats" || f.muscle === "middle-back"));
  if (!backAlready && live("balance") && push - pull >= 4 && push > pull * 1.5 && !pain.has("middle-back") && !pain.has("lats")) {
    // Back exercises only (rows and pulldowns): no "pull" that is really a shoulder, chest or trap exercise.
    const candidates = candidatesFor({ patterns: PULL, muscles: ["lats", "middle-back"], all: input.all, have: input.have, exclude: inProgram, maxDifficulty, preferIsolation: false });
    if (candidates.length) {
      const want = Math.min(4, Math.max(2, Math.ceil((push - pull) / 2)));
      const { at } = bestFor(["lats", "middle-back"], want);
      const perSession = reserve(at, want);
      out.push({ id: "balance", kind: "balance", push, pull, sessionId: at.s.id, addSets: perSession, candidates });
    }
  }

  // One muscle crowded into one session, and very long sessions.
  for (const { s } of sessions) {
    const per = direct(s);
    for (const [muscle, n] of per) if (CHECK_MUSCLES.includes(muscle) && n > cfg.volume.sessionCap) push2({ id: `crowded:${s.id}:${muscle}`, kind: "crowded", muscle, sessionId: s.id, sets: Math.round(n * 10) / 10, cap: cfg.volume.sessionCap });
    const minutes = estimateMinutes(s);
    if (minutes > LONG_SESSION_MIN) push2({ id: `long:${s.id}`, kind: "long", sessionId: s.id, minutes });
  }

  return out;
}
