import type { Exercise, Muscle } from "../library/types";
import type { ExerciseSlot, Program, SessionTemplate } from "../program/types";
import type { CoachConfig } from "./config";

export interface AllocSlot {
  sessionId: string;
  slot: ExerciseSlot;
  exercise: Exercise;
  /** How many weekdays this session appears on. 0 = not scheduled this week. */
  mult: number;
  sets: number;
}

export function allocSlots(program: Program, lookup: (id: string) => Exercise | undefined): AllocSlot[] {
  const mult = new Map<string, number>();
  for (const id of program.week) if (id) mult.set(id, (mult.get(id) ?? 0) + 1);
  const out: AllocSlot[] = [];
  for (const s of program.sessions as SessionTemplate[]) for (const slot of s.exercises) {
    const exercise = lookup(slot.exerciseId);
    if (exercise) out.push({ sessionId: s.id, slot, exercise, mult: mult.get(s.id) ?? 0, sets: slot.sets });
  }
  return out;
}

const minSets = (a: AllocSlot, cfg: CoachConfig) => (a.exercise.mechanic === "isolation" ? cfg.volume.minSetsIsolation : cfg.volume.minSetsCompound);

/** Weighted sets of `muscle` inside one session (per occurrence), counting secondary muscles. */
function sessionTotal(slots: readonly AllocSlot[], sessionId: string, muscle: Muscle, cfg: CoachConfig): number {
  let t = 0;
  for (const a of slots) {
    if (a.sessionId !== sessionId) continue;
    if (a.exercise.primary.includes(muscle)) t += a.sets;
    else if (a.exercise.secondary.includes(muscle)) t += a.sets * cfg.secondaryWeight;
  }
  return t;
}

/**
 * Move a muscle's weekly set count by `delta` by adding/removing sets on the exercises that train it directly,
 * spreading across sessions and respecting per-exercise and per-session limits. Mutates `slots[].sets`.
 * Returns how many sets could not be placed.
 */
export function applyDelta(slots: AllocSlot[], muscle: Muscle, delta: number, cfg: CoachConfig): number {
  const direct = slots.filter(a => a.mult > 0 && a.exercise.primary.includes(muscle));
  let left = Math.abs(delta);
  while (left > 0) {
    let pick: AllocSlot | undefined;
    if (delta > 0) {
      const ok = direct.filter(a => a.sets < cfg.volume.maxSetsPerExercise && sessionTotal(slots, a.sessionId, muscle, cfg) + 1 <= cfg.volume.sessionCap);
      pick = ok.sort((a, b) =>
        sessionTotal(slots, a.sessionId, muscle, cfg) - sessionTotal(slots, b.sessionId, muscle, cfg) || a.sets - b.sets || a.exercise.fatigue - b.exercise.fatigue)[0];
      if (pick) pick.sets += 1;
    } else {
      const ok = direct.filter(a => a.sets > minSets(a, cfg));
      pick = ok.sort((a, b) =>
        b.sets - a.sets || sessionTotal(slots, b.sessionId, muscle, cfg) - sessionTotal(slots, a.sessionId, muscle, cfg) || b.exercise.fatigue - a.exercise.fatigue)[0];
      if (pick) pick.sets -= 1;
    }
    if (!pick) break;
    left -= Math.max(1, pick.mult); // a session scheduled twice moves the week by two sets per set
  }
  return left;
}

/** Realized weekly weighted sets per muscle (including how often each session is scheduled). */
export function realized(slots: readonly AllocSlot[], cfg: CoachConfig): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const a of slots) {
    if (a.mult === 0) continue;
    for (const m of a.exercise.primary) out.set(m, (out.get(m) ?? 0) + a.sets * a.mult);
    for (const m of a.exercise.secondary) out.set(m, (out.get(m) ?? 0) + a.sets * a.mult * cfg.secondaryWeight);
  }
  return out;
}
