import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import type { LibraryApi } from "../library/useLibrary";
import { addDays, weekStart } from "../program/schedule";
import type { Program } from "../program/types";
import type { ProgramApi } from "../program/useProgram";
import type { SorenessRecord } from "../feedback/soreness";
import type { WorkoutLog } from "../workout/types";
import { applyDecisions, beforeValues, toRecords, type Decision } from "./apply";
import { BASE, KEEP, loadCoachData, makePlan } from "./run";
import { rejectionsFrom, type CoachSuggestionRecord, type SlotValues } from "./records";
import type { BodyWeightPoint, CoachPlan } from "./types";


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
  /** Answer a "you keep skipping this" question. */
  dropAnswer: (slotId: string, answer: "optional" | "remove" | "keep") => Promise<void>;
}

/** Runs the coach on real data and persists accept / edit / reject decisions. */
export function useCoach(prog: ProgramApi, lib: LibraryApi, finished: readonly WorkoutLog[], initialTarget?: "this" | "next"): CoachApi {
  const { settings, profile, dataVersion } = useApp();
  const [soreness, setSoreness] = useState<SorenessRecord[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightPoint[]>([]);
  const [records, setRecords] = useState<CoachSuggestionRecord[]>([]);
  const [baselines, setBaselines] = useState<Map<string, Program>>(new Map());
  const [keptSlots, setKeptSlots] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const today = prog.todayKey;
  // A brand-new user plans the week they are in; everyone else plans the coming week unless they ask for this one.
  const [chosen, setChosen] = useState<"next" | "this" | null>(initialTarget ?? null);
  const target: "next" | "this" = chosen ?? (finished.length === 0 ? "this" : "next");
  const targetWeekStart = target === "this" ? weekStart(today) : addDays(weekStart(today), 7);

  const reload = useCallback(async () => {
    const d = await loadCoachData();
    setSoreness(d.soreness);
    setBodyWeights(d.bodyWeights);
    setRecords(d.records);
    setBaselines(d.baselines);
    setKeptSlots(d.keptSlots);
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
    if (!base) return null;
    return makePlan({ program: base, lib, finished, soreness, bodyWeights, rejections, keptSlots, profile, settings, today, targetWeekStart });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lib is a fresh object each render; its data is what matters
  }, [baseline, program, lib.ready, lib.all, lib.byId, finished, soreness, bodyWeights, rejections, keptSlots, profile, settings.region, settings.weightUnit, today, targetWeekStart]);

  const decideNow = useCallback(async (decisions: Map<string, Decision>) => {
    if (!plan || !program || decisions.size === 0) return;
    // Freeze the baseline the first time anything is decided, so the remaining proposals stay put.
    // Read the stored state, not the render's: a queued decision must see the one saved just before it.
    const fresh = await loadCoachData();
    if (!fresh.baselines.has(targetWeekStart)) await repo.put("suggestions", { id: BASE + targetWeekStart, weekKey: targetWeekStart, program, schemaVersion: SCHEMA_VERSION } as never);
    const prior = new Map(fresh.records.filter(r => r.weekKey === targetWeekStart).map(r => [r.slotId, r]));
    // Undoing an earlier accept restores the values the exercise had before.
    const toApply = new Map<string, Decision>();
    for (const [slotId, d] of decisions) {
      const was = prior.get(slotId);
      if (d.status === "rejected" && was && was.status !== "rejected") toApply.set(slotId, { status: "edited", values: was.before, swapTo: undefined });
      else toApply.set(slotId, d);
    }
    // Apply onto the latest stored program: quick taps (Accept, then Keep on another exercise) must not save a stale copy.
    const latest = ((await repo.get("programs", program.id)) as unknown as Program | undefined) ?? program;
    if ([...toApply.values()].some(d => d.status !== "rejected")) await prog.save(applyDecisions(latest, plan, toApply));
    for (const rec of toRecords(plan, decisions, id => lib.byId(id)?.primary[0] ?? "other")) await repo.put("suggestions", rec as never);
    await reload();
  }, [plan, program, targetWeekStart, prog, lib, reload]);

  // Decisions run one at a time, so a quick second tap never reads the program before the first one saved it.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const decide = useCallback((decisions: Map<string, Decision>) => {
    const run = queue.current.then(() => decideNow(decisions));
    queue.current = run.catch(() => {});
    return run;
  }, [decideNow]);

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
    dropAnswer: async (slotId, answer) => {
      if (!program) return;
      if (answer === "keep") await repo.put("suggestions", { id: KEEP + slotId, dayKey: today, schemaVersion: SCHEMA_VERSION } as never);
      else await prog.save({
        ...program,
        sessions: program.sessions.map(s => ({
          ...s,
          exercises: answer === "remove" ? s.exercises.filter(e => e.id !== slotId) : s.exercises.map(e => (e.id === slotId ? { ...e, optional: true } : e)),
        })),
      });
      await reload();
    },
    reset: async () => {
      for (const r of records.filter(x => x.weekKey === targetWeekStart)) await repo.remove("suggestions", r.id);
      await repo.remove("suggestions", BASE + targetWeekStart);
      await reload();
    },
  };
}

export { beforeValues };
