import { useCallback, useEffect, useRef, useState } from "react";
import { repo } from "../db";
import type { WorkoutLog } from "./types";

/**
 * Holds the workout being logged and autosaves it as a draft (finishedAt === null) on every change,
 * so an accidental refresh or a killed tab never loses a session.
 */
export function useWorkout(initial: WorkoutLog) {
  const [workout, setWorkout] = useState(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current) return;
    dirty.current = false;
    await repo.put("workouts", latest.current as never);
  }, []);

  const mutate = useCallback((fn: (w: WorkoutLog) => WorkoutLog) => {
    const next = fn(latest.current);
    latest.current = next;
    dirty.current = true;
    setWorkout(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 300);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide as never);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide as never);
      void flush();
    };
  }, [flush]);

  return { workout, mutate, flush };
}
