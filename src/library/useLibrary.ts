import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import { newId } from "../lib/id";
import { loadBundled } from "./data";
import type { CustomExerciseRecord, Exercise, ExerciseFlagRecord } from "./types";

const FLAG = "flag:";
const CUSTOM = "custom:";

export const customToExercise = (r: CustomExerciseRecord): Exercise => ({
  id: r.id,
  name: { en: r.nameEn || r.nameJa, ja: r.nameJa || r.nameEn },
  primary: r.primary,
  secondary: r.secondary,
  equipment: r.equipment,
  pattern: r.pattern,
  mechanic: r.mechanic,
  difficulty: 2,
  fatigue: r.fatigue,
  category: "strength",
  joints: [],
  frames: 0,
  media: r.photo ? { kind: "image", url: r.photo } : undefined,
  custom: true,
  notes: r.notes,
  restSec: r.restSec,
});

export interface LibraryApi {
  ready: boolean;
  all: Exercise[];
  byId: (id: string) => Exercise | undefined;
  favorites: Set<string>;
  recent: Map<string, string>;
  toggleFavorite: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
  saveCustom: (input: Omit<CustomExerciseRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion"> & { id?: string }) => Promise<Exercise>;
  removeCustom: (id: string) => Promise<CustomExerciseRecord | undefined>;
  restoreCustom: (rec: CustomExerciseRecord) => Promise<void>;
}

/** Bundled exercises + the user's custom exercises + their favorites/recents. */
export function useLibrary(): LibraryApi {
  const { dataVersion } = useApp();
  const [bundled, setBundled] = useState<Exercise[] | null>(null);
  const [customs, setCustoms] = useState<CustomExerciseRecord[]>([]);
  const [flags, setFlags] = useState<ExerciseFlagRecord[]>([]);

  const reload = useCallback(async () => {
    const rows = await repo.list("exercises");
    setCustoms(rows.filter(r => r.id.startsWith(CUSTOM)) as unknown as CustomExerciseRecord[]);
    setFlags(rows.filter(r => r.id.startsWith(FLAG)) as unknown as ExerciseFlagRecord[]);
  }, []);

  useEffect(() => { void loadBundled().then(setBundled); }, []);
  useEffect(() => { void reload(); }, [reload, dataVersion]);

  const all = useMemo(() => [...(bundled ?? []), ...customs.map(customToExercise)], [bundled, customs]);
  const map = useMemo(() => new Map(all.map(e => [e.id, e])), [all]);
  const favorites = useMemo(() => new Set([...flags.filter(f => f.favorite).map(f => f.exerciseId), ...customs.filter(c => c.favorite).map(c => c.id)]), [flags, customs]);
  const recent = useMemo(() => new Map(flags.filter(f => f.lastUsedAt).map(f => [f.exerciseId, f.lastUsedAt!])), [flags]);

  const patchFlag = useCallback(async (exerciseId: string, patch: Partial<ExerciseFlagRecord>) => {
    const id = FLAG + exerciseId;
    const cur = (await repo.get("exercises", id)) as unknown as ExerciseFlagRecord | undefined;
    await repo.put("exercises", { favorite: false, lastUsedAt: null, ...cur, ...patch, id, exerciseId });
    await reload();
  }, [reload]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (id.startsWith(CUSTOM)) {
      const cur = customs.find(c => c.id === id);
      if (cur) { await repo.put("exercises", { ...cur, favorite: !cur.favorite }); await reload(); }
    } else await patchFlag(id, { favorite: !favorites.has(id) });
  }, [customs, favorites, patchFlag, reload]);

  const markUsed = useCallback((id: string) => patchFlag(id, { lastUsedAt: new Date().toISOString() }), [patchFlag]);

  const saveCustom: LibraryApi["saveCustom"] = useCallback(async input => {
    const saved = (await repo.put("exercises", { ...input, id: input.id ?? CUSTOM + newId(), schemaVersion: SCHEMA_VERSION })) as unknown as CustomExerciseRecord;
    await reload();
    return customToExercise(saved);
  }, [reload]);

  const removeCustom = useCallback(async (id: string) => {
    const cur = customs.find(c => c.id === id);
    await repo.remove("exercises", id);
    await reload();
    return cur;
  }, [customs, reload]);

  const restoreCustom = useCallback(async (rec: CustomExerciseRecord) => {
    await repo.put("exercises", rec as never);
    await reload();
  }, [reload]);

  return { ready: bundled !== null, all, byId: id => map.get(id), favorites, recent, toggleFavorite, markUsed, saveCustom, removeCustom, restoreCustom };
}
