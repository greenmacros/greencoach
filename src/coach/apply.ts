import { addDays } from "../program/schedule";
import type { Program } from "../program/types";
import type { CoachPlan, SlotSuggestion } from "./types";
import { suggestionId, type CoachSuggestionRecord, type SlotValues, type SuggestionStatus } from "./records";

export interface Decision {
  status: SuggestionStatus;
  /** Values the user typed over the proposal (status 'edited'). */
  values?: Partial<SlotValues>;
  /** Replace the exercise (accepted swap). */
  swapTo?: string;
}

export const proposedValues = (s: SlotSuggestion): SlotValues => ({
  sets: s.next.sets, repMin: s.next.repMin, repMax: s.next.repMax, rir: s.next.rir, restSec: s.next.restSec, weightKg: s.next.weightKg, bands: s.next.bands ?? null,
});

export const beforeValues = (s: SlotSuggestion): SlotValues => ({
  sets: s.last.sets, repMin: s.last.repMin, repMax: s.last.repMax, rir: s.last.rir, restSec: s.last.restSec, weightKg: s.last.weightKg, bands: s.last.bands ?? null,
});

/**
 * Write the accepted/edited suggestions into the program. Rejected slots are left exactly as they were.
 * A first plan or a ramp-in anchors week 1 of the mesocycle to the planned week; an accepted early deload
 * shifts the mesocycle so the planned week is its deload week (and a fresh mesocycle follows).
 */
export function applyDecisions(program: Program, plan: CoachPlan, decisions: ReadonlyMap<string, Decision>): Program {
  const bySlot = new Map(plan.slots.map(s => [s.slotId, s]));
  let applied = 0;
  const sessions = program.sessions.map(sess => ({
    ...sess,
    exercises: sess.exercises.map(slot => {
      const d = decisions.get(slot.id);
      const s = bySlot.get(slot.id);
      if (!d || !s || d.status === "rejected") return slot;
      applied++;
      const v = { ...proposedValues(s), ...(d.values ?? {}) };
      return {
        ...slot,
        exerciseId: d.swapTo ?? slot.exerciseId,
        sets: v.sets, repMin: v.repMin, repMax: v.repMax, rir: v.rir, restSec: v.restSec,
        // A swapped exercise starts without a remembered weight.
        weightKg: d.swapTo ? null : v.weightKg,
        bands: d.swapTo ? null : v.bands ?? slot.bands ?? null,
      };
    }),
  }));
  let mesoStartDayKey = program.mesoStartDayKey;
  if (applied > 0) {
    if (plan.mode === "first" || plan.mode === "ramp") mesoStartDayKey = plan.targetWeekStart;
    else if (plan.deload.type === "early") mesoStartDayKey = addDays(plan.targetWeekStart, -7 * Math.min(8, Math.max(3, program.accumulationWeeks)));
  }
  return { ...program, sessions, mesoStartDayKey };
}

/** Records to persist for the decisions made (including rejections, which the coach remembers). */
export function toRecords(plan: CoachPlan, decisions: ReadonlyMap<string, Decision>, primaryMuscle: (exerciseId: string) => string): Omit<CoachSuggestionRecord, "createdAt" | "updatedAt" | "schemaVersion">[] {
  const out: Omit<CoachSuggestionRecord, "createdAt" | "updatedAt" | "schemaVersion">[] = [];
  for (const s of plan.slots) {
    const d = decisions.get(s.slotId);
    if (!d) continue;
    const proposed = proposedValues(s);
    out.push({
      id: suggestionId(plan.targetWeekStart, s.slotId), weekKey: plan.targetWeekStart, slotId: s.slotId, exerciseId: s.exerciseId,
      muscle: primaryMuscle(s.exerciseId), status: d.status, proposed, final: d.status === "rejected" ? beforeValues(s) : { ...proposed, ...(d.values ?? {}) },
      before: beforeValues(s), reason: s.reason, swapTo: d.swapTo,
    });
  }
  return out;
}

export const sameBands = (x: readonly string[] | null | undefined, y: readonly string[] | null | undefined) =>
  [...(x ?? [])].sort().join("+") === [...(y ?? [])].sort().join("+");

/** True when the proposal changes nothing, so the UI can show "No change" and skip the buttons. */
export const isNoChange = (s: SlotSuggestion): boolean => {
  const a = proposedValues(s), b = beforeValues(s);
  return (Object.keys(a) as (keyof SlotValues)[]).every(k => (k === "bands" ? sameBands(a.bands, b.bands) : a[k] === b[k]));
};
