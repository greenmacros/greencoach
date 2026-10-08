import { repo } from "../db";
import type { Profile, Settings } from "../db/types";
import type { SorenessRecord } from "../feedback/soreness";
import { equipmentFor, substitutes } from "../library/search";
import type { LibraryApi } from "../library/useLibrary";
import type { Program } from "../program/types";
import type { WorkoutLog } from "../workout/types";
import { planNextWeek } from "./engine";
import { bandsOf } from "../bands/bands";
import type { CoachSuggestionRecord } from "./records";
import type { BodyWeightPoint, CoachPlan, Rejection } from "./types";

export const BASE = "base:";

export interface CoachData {
  soreness: SorenessRecord[];
  bodyWeights: BodyWeightPoint[];
  /** Per-slot decisions (`sug:` rows). */
  records: CoachSuggestionRecord[];
  /** Program snapshots the plan of each week was made from (`base:<week>`). */
  baselines: Map<string, Program>;
}

export async function loadCoachData(): Promise<CoachData> {
  const fb = await repo.list("feedback");
  const bm = await repo.list("bodyMetrics");
  const sg = await repo.list("suggestions");
  return {
    soreness: fb.filter(r => r.kind === "soreness") as unknown as SorenessRecord[],
    bodyWeights: bm.filter(r => typeof r.weightKg === "number").map(r => ({ dayKey: r.dayKey as string, kg: r.weightKg as number })),
    records: sg.filter(r => r.id.startsWith("sug:")) as unknown as CoachSuggestionRecord[],
    baselines: new Map(sg.filter(r => r.id.startsWith(BASE)).map(r => [r.weekKey as string, r.program as Program])),
  };
}

export interface PlanArgs {
  program: Program;
  lib: LibraryApi;
  finished: readonly WorkoutLog[];
  soreness: readonly SorenessRecord[];
  bodyWeights: readonly BodyWeightPoint[];
  rejections: readonly Rejection[];
  profile: Profile;
  settings: Settings;
  today: string;
  targetWeekStart: string;
}

/** The single place the engine is called from the app, so automatic and reviewed plans are identical. */
export function makePlan(a: PlanArgs): CoachPlan | null {
  if (!a.lib.ready) return null;
  const avail = equipmentFor(a.profile.equipment);
  return planNextWeek({
    today: a.today, targetWeekStart: a.targetWeekStart, program: a.program, workouts: a.finished, soreness: a.soreness,
    bodyWeights: a.bodyWeights, rejections: a.rejections, bands: bandsOf(a.settings),
    profile: { experience: a.profile.experience, goal: a.profile.goal, phase: a.profile.phase, equipment: a.profile.equipment, region: a.settings.region, weightUnit: a.settings.weightUnit },
    lookup: a.lib.byId, substitutes: ex => substitutes(a.lib.all, ex, avail),
  });
}
