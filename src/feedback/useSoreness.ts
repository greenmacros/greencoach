import { useCallback, useEffect, useMemo, useState } from "react";
import { repo } from "../db";
import { SCHEMA_VERSION } from "../db/types";
import type { Exercise } from "../library/types";
import type { WorkoutLog } from "../workout/types";
import { sorenessId, sorenessQuestions, type SorenessLevel, type SorenessRecord } from "./soreness";

/** The start-of-session soreness questions for a workout and the answers given so far. */
export function useSoreness(workout: WorkoutLog, history: readonly WorkoutLog[], lookup: (id: string) => Exercise | undefined) {
  const [answers, setAnswers] = useState<Map<string, SorenessLevel>>(new Map());

  useEffect(() => {
    void repo.list<SorenessRecord & Record<string, unknown>>("feedback").then(rows =>
      setAnswers(new Map(rows.filter(r => r.kind === "soreness" && r.workoutId === workout.id).map(r => [r.muscle, r.level]))));
  }, [workout.id]);

  // Questions are fixed from the exercises present; adding exercises mid-session can add more.
  const exerciseKey = workout.exercises.map(e => e.exerciseId).join(",");
  const questions = useMemo(
    () => sorenessQuestions(workout, history, lookup),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseKey, history, workout.id, workout.dayKey, workout.startedAt],
  );

  const answer = useCallback(async (muscle: SorenessRecord["muscle"], level: SorenessLevel, prevWorkoutId: string) => {
    setAnswers(m => new Map(m).set(muscle, level));
    await repo.put("feedback", {
      id: sorenessId(workout.id, muscle), kind: "soreness", workoutId: workout.id, muscle, level, prevWorkoutId, dayKey: workout.dayKey, schemaVersion: SCHEMA_VERSION,
    } as never);
  }, [workout.id, workout.dayKey]);

  return { questions, answers, answer };
}
