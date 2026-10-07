import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import type { LibraryApi } from "../library/useLibrary";
import { equipmentFor, substitutes } from "../library/search";
import { addDays, weekStart } from "../program/schedule";
import type { Program } from "../program/types";
import type { ProgramApi } from "../program/useProgram";
import type { SorenessRecord } from "../feedback/soreness";
import type { WorkoutLog } from "../workout/types";
import { applyDecisions, beforeValues, toRecords, type Decision } from "./apply";
import { planNextWeek } from "./engine";
import { rejectionsFrom, type CoachSuggestionRecord, type SlotValues } from "./records";
import type { BodyWeightPoint, CoachPlan } from "./types";

const BASE = "base:";

export interface CoachApi {
  ready: boolean;
  plan: CoachPlan | null;
  /** Stored decisions for the planned week, by slot id. */
  decided: Map<string, CoachSuggestionRecord>;
  target: "next" | "this";
  setTarget: (t: "next" | "this") => void;
  accept: (slotId: string, swapTo?: string) => Promise<void>;
  edit: (slotId: string, values: Partial<SlotValues>) => Promise<void>;
  reject: (slotId: string) => Promise<void>;
  acceptAll: () => Promise<void>;
  reset: () => Promise<void>;
}

/** Runs the coach on real data and persists accept / edit / reject decisions. */
export function useCoach(prog: ProgramApi, lib: LibraryApi, finished: readonly WorkoutLog[]): CoachApi {
  const { settings, profile, dataVersion } = useApp();
  const [soreness, setSoreness] = useState<SorenessRecord[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightPoint[]>([]);
  const [records, setRecords] = useState<CoachSuggestionRecord[]>([]);
  const [baselines, setBaselines] = useState<Map<string, Program>>(new Map());
  const [ready, setReady] = useState(false);
  const today = prog.todayKey;
  // A brand-new user plans the week they are in; everyone else plans the coming week unless they ask for this one.
  const [chosen, setChosen] = useState<"next" | "this" | null>(null);
  const target: "next" | "this" = chosen ?? (finished.length === 0 ? "this" : "next");
  const targetWeekStart = target === "this" ? weekStart(today) : addDays(weekStart(today), 7);

  const reload = useCallback(async () => {
    const fb = await repo.list("feedback");
    setSoreness(fb.filter(r => r.kind === "soreness") as unknown as SorenessRecord[]);
    const bm = await repo.list("bodyMetrics");
    setBodyWeights(bm.filter(r => typeof r.weightKg === "number").map(r => ({ dayKey: r.dayKey as string, kg: r.weightKg as number })));
    const sg = await repo.list("suggestions");
    setRecords(sg.filter(r => r.id.startsWith("sug:")) as unknown as CoachSuggestionRecord[]);
    setBaselines(new Map(sg.filter(r => r.id.startsWith(BASE)).map(r => [r.weekKey as string, r.program as Program])));
    setReady(true);
  }, []);
  useEffect(() => { void reload(); }, [reload, dataVersion]);

  const program = prog.active;
  const baseline = baselines.get(targetWeekStart);
  const decided = useMemo(() => new Map(records.filter(r => r.weekKey === targetWeekStart).map(r => [r.slotId, r])), [records, targetWeekStart]);
  // Rejections from earlier weeks damp repeat suggestions; this week's own decisions must not change this week's plan.
  const rejections = useMemo(() => rejectionsFrom(records.filter(r => r.weekKey < targetWeekStart)), [records, targetWeekStart]);

  const plan = useMemo<CoachPlan | null>(() => {
    const base = baseline ?? program;
    if (!base || !lib.ready) return null;
    const avail = equipmentFor(profile.equipment);
    return planNextWeek({
      today, targetWeekStart, program: base, workouts: finished, soreness, bodyWeights, rejections,
      profile: { experience: profile.experience, goal: profile.goal, phase: profile.phase, equipment: profile.equipment, region: settings.region, weightUnit: settings.weightUnit },
      lookup: lib.byId, substitutes: ex => substitutes(lib.all, ex, avail),
    });
  }, [baseline, program, lib.ready, lib.all, lib.byId, finished, soreness, bodyWeights, rejections, profile, settings.region, settings.weightUnit, today, targetWeekStart]);

  const decide = useCallback(async (decisions: Map<string, Decision>) => {
    if (!plan || !program || decisions.size === 0) return;
    // Freeze the baseline the first time anything is decided, so the remaining proposals stay put.
    if (!baselines.has(targetWeekStart)) await repo.put("suggestions", { id: BASE + targetWeekStart, weekKey: targetWeekStart, program, schemaVersion: SCHEMA_VERSION } as never);
    const prior = new Map(records.filter(r => r.weekKey === targetWeekStart).map(r => [r.slotId, r]));
    // Undoing an earlier accept restores the values the exercise had before.
    const toApply = new Map<string, Decision>();
    for (const [slotId, d] of decisions) {
      const was = prior.get(slotId);
      if (d.status === "rejected" && was && was.status !== "rejected") toApply.set(slotId, { status: "edited", values: was.before, swapTo: undefined });
      else toApply.set(slotId, d);
    }
    const next = applyDecisions(program, plan, toApply);
    if (decisions.size > 0 && next !== program) await prog.save(next);
    for (const rec of toRecords(plan, decisions, id => lib.byId(id)?.primary[0] ?? "other")) await repo.put("suggestions", rec as never);
    await reload();
  }, [plan, program, baselines, records, targetWeekStart, prog, lib, reload]);

  const slotSet = (slotId: string, d: Decision) => decide(new Map([[slotId, d]]));
  return {
    ready, plan, decided, target, setTarget: setChosen,
    accept: (slotId, swapTo) => slotSet(slotId, { status: "accepted", swapTo }),
    edit: (slotId, values) => slotSet(slotId, { status: "edited", values }),
    reject: slotId => slotSet(slotId, { status: "rejected" }),
    acceptAll: async () => {
      if (!plan) return;
      const m = new Map<string, Decision>();
      for (const s of plan.slots) if (!decided.has(s.slotId)) m.set(s.slotId, { status: "accepted" });
      await decide(m);
    },
    reset: async () => {
      for (const r of records.filter(x => x.weekKey === targetWeekStart)) await repo.remove("suggestions", r.id);
      await repo.remove("suggestions", BASE + targetWeekStart);
      await reload();
    },
  };
}

export { beforeValues };
