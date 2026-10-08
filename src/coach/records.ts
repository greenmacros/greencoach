import type { BaseRecord } from "../db/types";
import type { Reason, Rejection } from "./types";

export type SuggestionStatus = "accepted" | "rejected" | "edited";

export interface SlotValues { sets: number; repMin: number; repMax: number; rir: number; restSec: number; weightKg: number | null; bands?: string[] | null }

/** One decision on one exercise suggestion, stored in the `suggestions` table (id `sug:<weekKey>:<slotId>`). */
export interface CoachSuggestionRecord extends BaseRecord {
  weekKey: string;
  slotId: string;
  exerciseId: string;
  muscle: string;
  status: SuggestionStatus;
  proposed: SlotValues;
  final: SlotValues;
  /** What the coach had before (for judging what the user turned down). */
  before: SlotValues;
  reason: Reason;
  /** Exercise the user swapped to, if any. */
  swapTo?: string;
}

export const suggestionId = (weekKey: string, slotId: string) => `sug:${weekKey}:${slotId}`;

/** Which kinds of increase did the user turn down? A rejected raise damps the same raise next time. */
export function rejectionsFrom(records: readonly CoachSuggestionRecord[]): Rejection[] {
  const out: Rejection[] = [];
  for (const r of records) {
    if (r.status !== "rejected") continue;
    if ((r.proposed.weightKg ?? 0) > (r.before.weightKg ?? 0)) out.push({ weekKey: r.weekKey, scope: "slot", id: r.slotId, kind: "load" });
    if (r.proposed.sets > r.before.sets) out.push({ weekKey: r.weekKey, scope: "muscle", id: r.muscle, kind: "sets" });
  }
  return out;
}
