import { useCallback, useEffect, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import type { WorkoutLog } from "./types";

/** All workouts (finished history + any unfinished draft). */
export function useHistory() {
  const { dataVersion } = useApp();
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setWorkouts((await repo.list<WorkoutLog>("workouts")).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    setReady(true);
  }, []);

  useEffect(() => { void reload(); }, [reload, dataVersion]);

  const finished = workouts.filter(w => w.finishedAt);
  const drafts = workouts.filter(w => !w.finishedAt);
  return { workouts, finished, drafts, ready, reload };
}
