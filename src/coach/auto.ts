import { repo } from "../db";
import { SCHEMA_VERSION, type BaseRecord, type Profile, type Settings } from "../db/types";
import type { LibraryApi } from "../library/useLibrary";
import { weekStart } from "../program/schedule";
import type { Program } from "../program/types";
import type { WorkoutLog } from "../workout/types";
import { applyDecisions, beforeValues, isNoChange, proposedValues, toRecords, type Decision } from "./apply";
import { rejectionsFrom, type CoachSuggestionRecord, type SlotValues } from "./records";
import { BASE, loadCoachData, makePlan } from "./run";
import type { CoachPlan, PlanMode, Reason } from "./types";

export const AUTO = "auto:";

export interface AutoChange { slotId: string; exerciseId: string; before: SlotValues; after: SlotValues; reason: Reason }

/** What automatic coaching did for one week, stored in `suggestions` as `auto:<weekKey>`. */
export interface AutoRecord extends BaseRecord {
  weekKey: string;
  /** applied: written into the program. review: a big decision waits for the user. undone: the user reverted it. */
  status: "applied" | "review" | "undone";
  mode: PlanMode;
  earlyDeload: boolean;
  changes: AutoChange[];
  swaps: number;
  /** The user closed the summary card. */
  seen: boolean;
}

/**
 * Decide what automatic coaching may do with a plan. Small weekly changes are applied; anything that changes how the
 * week feels (early deload, welcome-back or ramp-in after a break) waits for the user. A first plan is never applied
 * automatically: without any training data the user's own program is the better start.
 */
export function autoAction(plan: CoachPlan): "apply" | "review" | "skip" {
  if (plan.mode === "first") return "skip";
  if (plan.mode === "ramp" || plan.mode === "welcome-back" || plan.deload.type === "early") return "review";
  return "apply";
}

export const changesOf = (plan: CoachPlan): AutoChange[] =>
  plan.slots.filter(s => !isNoChange(s)).map(s => ({ slotId: s.slotId, exerciseId: s.exerciseId, before: beforeValues(s), after: proposedValues(s), reason: s.reason }));

/**
 * Put back the values each changed slot had in `baseline` (the program the week was planned from). Slots the user
 * added or removed since then are left as they are.
 */
export function undoProgram(program: Program, baseline: Program, slotIds: ReadonlySet<string>): Program {
  const before = new Map(baseline.sessions.flatMap(s => s.exercises).filter(e => slotIds.has(e.id)).map(e => [e.id, e]));
  return {
    ...program,
    sessions: program.sessions.map(sess => ({
      ...sess,
      exercises: sess.exercises.map(slot => {
        const b = before.get(slot.id);
        return b ? { ...slot, exerciseId: b.exerciseId, sets: b.sets, repMin: b.repMin, repMax: b.repMax, rir: b.rir, restSec: b.restSec, weightKg: b.weightKg, bands: b.bands ?? null } : slot;
      }),
    })),
  };
}

export interface AutoContext {
  program: Program;
  save: (p: Program) => Promise<unknown>;
  finished: readonly WorkoutLog[];
  lib: LibraryApi;
  profile: Profile;
  settings: Settings;
  today: string;
}

const running = new Map<string, Promise<AutoRecord | null>>();

/** Run automatic coaching for the current week once. Returns this week's record (new or existing), or null. */
export function runAutoCoach(ctx: AutoContext): Promise<AutoRecord | null> {
  const weekKey = weekStart(ctx.today);
  const key = ctx.program.id + weekKey;
  // Only concurrent calls share a run (e.g. React's double effects); a later call checks again.
  if (!running.has(key)) running.set(key, run(ctx, weekKey).finally(() => running.delete(key)));
  return running.get(key)!;
}

async function run(ctx: AutoContext, weekKey: string): Promise<AutoRecord | null> {
  const existing = (await repo.get("suggestions", AUTO + weekKey)) as unknown as AutoRecord | undefined;
  if (existing) return existing;
  const data = await loadCoachData();
  // The user already reviewed this week by hand: leave it alone.
  if (data.baselines.has(weekKey) || data.records.some(r => r.weekKey === weekKey)) return null;
  if (!ctx.finished.some(w => w.dayKey < weekKey)) return null;

  const plan = makePlan({
    program: ctx.program, lib: ctx.lib, finished: ctx.finished, soreness: data.soreness, bodyWeights: data.bodyWeights,
    rejections: rejectionsFrom(data.records.filter(r => r.weekKey < weekKey)), profile: ctx.profile, settings: ctx.settings,
    today: ctx.today, targetWeekStart: weekKey,
  });
  if (!plan) return null;
  const action = autoAction(plan);
  if (action === "skip") return null;

  const rec: Omit<AutoRecord, "createdAt" | "updatedAt"> = {
    id: AUTO + weekKey, schemaVersion: SCHEMA_VERSION, weekKey, status: action === "apply" ? "applied" : "review",
    mode: plan.mode, earlyDeload: plan.deload.type === "early", changes: changesOf(plan), swaps: plan.swaps.length, seen: false,
  };
  if (action === "apply") {
    await repo.put("suggestions", { id: BASE + weekKey, weekKey, program: ctx.program, schemaVersion: SCHEMA_VERSION } as never);
    const decisions = new Map<string, Decision>(plan.slots.map(s => [s.slotId, { status: "accepted" }]));
    const next = applyDecisions(ctx.program, plan, decisions);
    await ctx.save(next);
    for (const r of toRecords(plan, decisions, id => ctx.lib.byId(id)?.primary[0] ?? "other")) await repo.put("suggestions", r as never);
  }
  return (await repo.put("suggestions", rec as never)) as unknown as AutoRecord;
}

/** Revert this week's automatic changes. They count as turned down, so the coach is gentler with the same raises. */
export async function undoAutoCoach(rec: AutoRecord, program: Program, save: (p: Program) => Promise<unknown>): Promise<AutoRecord> {
  const sg = (await repo.list("suggestions")) as unknown as CoachSuggestionRecord[];
  const week = sg.filter(r => r.id.startsWith("sug:") && r.weekKey === rec.weekKey);
  const base = (await repo.get("suggestions", BASE + rec.weekKey)) as unknown as { program: Program } | undefined;
  if (base) await save(undoProgram(program, base.program, new Set(week.filter(r => r.status !== "rejected").map(r => r.slotId))));
  for (const r of week) if (r.status !== "rejected") await repo.put("suggestions", { ...r, status: "rejected", final: r.before } as never);
  return (await repo.put("suggestions", { ...rec, status: "undone", seen: false } as never)) as unknown as AutoRecord;
}

export async function dismissAutoCoach(rec: AutoRecord): Promise<AutoRecord> {
  return (await repo.put("suggestions", { ...rec, seen: true } as never)) as unknown as AutoRecord;
}
