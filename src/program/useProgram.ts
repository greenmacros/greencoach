import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import { newId } from "../lib/id";
import { instantiateTemplate, type TemplateSpec } from "./templates";
import { resolveDay, trainingDayKey, type OverridePatch, type ResolvedDay } from "./schedule";
import { OVERRIDE_PREFIX, PROGRAM_PREFIX, type DayOverride, type Program, type SessionTemplate } from "./types";

export interface ProgramApi {
  ready: boolean;
  programs: Program[];
  active: Program | undefined;
  overrides: Map<string, DayOverride>;
  /** Day keys that have a finished workout (filled in from workout history). */
  completed: Set<string>;
  /** Training day for "now", ticking so it flips at the day-start hour. */
  todayKey: string;
  resolve: (dayKey: string) => ResolvedDay | null;
  createFromTemplate: (spec: TemplateSpec) => Promise<Program>;
  save: (p: Program) => Promise<Program>;
  setActive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<Program | undefined>;
  restore: (p: Program) => Promise<void>;
  applyPatches: (patches: OverridePatch[]) => Promise<DayOverride[]>;
  restoreOverrides: (before: DayOverride[], touched: string[]) => Promise<void>;
  newSession: (name: string) => SessionTemplate;
}

/** Programs, one-off day overrides and the current training day. */
export function useProgram(): ProgramApi {
  const { settings, dataVersion } = useApp();
  const [ready, setReady] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [overrides, setOverrides] = useState<Map<string, DayOverride>>(new Map());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    const onVis = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const reload = useCallback(async () => {
    const rows = await repo.list("programs");
    setPrograms((rows.filter(r => r.id.startsWith(PROGRAM_PREFIX)) as unknown as Program[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    setOverrides(new Map((rows.filter(r => r.id.startsWith(OVERRIDE_PREFIX)) as unknown as DayOverride[]).map(o => [o.dayKey, o])));
    const w = await repo.list("workouts");
    setCompleted(new Set(w.filter(x => x.finishedAt).map(x => x.dayKey as string)));
    setReady(true);
  }, []);

  useEffect(() => { void reload(); }, [reload, dataVersion]);

  const active = useMemo(() => programs.find(p => p.active) ?? programs[0], [programs]);
  const todayKey = trainingDayKey(now, settings.dayStartHour);

  const resolve = useCallback((dayKey: string) => (active ? resolveDay(active, overrides, dayKey, completed) : null), [active, overrides, completed]);

  const save = useCallback(async (p: Program) => {
    const saved = (await repo.put("programs", p as never)) as unknown as Program;
    await reload();
    return saved;
  }, [reload]);

  const setActive = useCallback(async (id: string) => {
    for (const p of programs) if (p.active !== (p.id === id)) await repo.put("programs", { ...p, active: p.id === id } as never);
    await reload();
  }, [programs, reload]);

  const createFromTemplate = useCallback(async (spec: TemplateSpec) => {
    for (const p of programs) if (p.active) await repo.put("programs", { ...p, active: false } as never);
    const base = instantiateTemplate(spec, settings.lang, todayKey);
    const saved = (await repo.put("programs", { ...base, id: PROGRAM_PREFIX + newId(), schemaVersion: SCHEMA_VERSION } as never)) as unknown as Program;
    await reload();
    return saved;
  }, [programs, settings.lang, todayKey, reload]);

  const remove = useCallback(async (id: string) => {
    const cur = programs.find(p => p.id === id);
    await repo.remove("programs", id);
    const rest = programs.filter(p => p.id !== id);
    if (cur?.active && rest[0]) await repo.put("programs", { ...rest[0], active: true } as never);
    await reload();
    return cur;
  }, [programs, reload]);

  const restore = useCallback(async (p: Program) => {
    await repo.put("programs", p as never);
    await reload();
  }, [reload]);

  const applyPatches = useCallback(async (patches: OverridePatch[]) => {
    const before: DayOverride[] = [];
    for (const patch of patches) {
      const id = OVERRIDE_PREFIX + patch.dayKey;
      const cur = overrides.get(patch.dayKey);
      if (cur) before.push(cur);
      if ("clear" in patch) await repo.remove("programs", id);
      else await repo.put("programs", { ...cur, id, dayKey: patch.dayKey, sessionId: patch.sessionId, skipped: patch.skipped } as never);
    }
    await reload();
    return before;
  }, [overrides, reload]);

  const restoreOverrides = useCallback(async (before: DayOverride[], touched: string[]) => {
    for (const k of touched) await repo.remove("programs", OVERRIDE_PREFIX + k);
    for (const o of before) await repo.put("programs", o as never);
    await reload();
  }, [reload]);

  const newSession = useCallback((name: string): SessionTemplate => ({ id: newId(), name, exercises: [] }), []);

  return { ready, programs, active, overrides, completed, todayKey, resolve, createFromTemplate, save, setActive, remove, restore, applyPatches, restoreOverrides, newSession };
}
