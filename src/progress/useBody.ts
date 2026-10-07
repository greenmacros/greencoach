import { useCallback, useEffect, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import { newId } from "../lib/id";
import type { BodyMetricRecord, GoalRecord, PhotoRecord } from "./types";

/** Body metrics, progress photos and goals. */
export function useBody() {
  const { dataVersion } = useApp();
  const [metrics, setMetrics] = useState<BodyMetricRecord[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [goals, setGoals] = useState<GoalRecord[]>([]);

  const reload = useCallback(async () => {
    const rows = await repo.list("bodyMetrics");
    setMetrics((rows.filter(r => r.id.startsWith("bm:")) as unknown as BodyMetricRecord[]).sort((a, b) => b.dayKey.localeCompare(a.dayKey)));
    setPhotos((rows.filter(r => r.id.startsWith("photo:")) as unknown as PhotoRecord[]).sort((a, b) => b.dayKey.localeCompare(a.dayKey)));
    setGoals((await repo.list<GoalRecord>("goals")).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);
  useEffect(() => { void reload(); }, [reload, dataVersion]);

  return {
    metrics, photos, goals, reload,
    /** One entry per day: logging again the same day updates that entry. */
    saveMetric: async (m: Omit<BodyMetricRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion">) => {
      const existing = metrics.find(x => x.dayKey === m.dayKey);
      await repo.put("bodyMetrics", { ...existing, ...m, id: existing?.id ?? `bm:${newId()}`, schemaVersion: SCHEMA_VERSION } as never);
      await reload();
    },
    removeMetric: async (id: string) => { await repo.remove("bodyMetrics", id); await reload(); },
    addPhoto: async (dayKey: string, dataUrl: string) => {
      await repo.put("bodyMetrics", { id: `photo:${newId()}`, dayKey, dataUrl, schemaVersion: SCHEMA_VERSION } as never);
      await reload();
    },
    removePhoto: async (id: string) => { await repo.remove("bodyMetrics", id); await reload(); },
    saveGoal: async (g: Omit<GoalRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion"> & { id?: string }) => {
      await repo.put("goals", { ...g, id: g.id ?? `goal:${newId()}`, schemaVersion: SCHEMA_VERSION } as never);
      await reload();
    },
    removeGoal: async (id: string) => { await repo.remove("goals", id); await reload(); },
  };
}

export type BodyApi = ReturnType<typeof useBody>;
