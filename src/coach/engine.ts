import { addDays, daysBetween, mesoPosition } from "../program/schedule";
import type { Muscle } from "../library/types";
import { allocSlots, applyDelta, realized } from "./allocate";
import { COACH_CONFIG } from "./config";
import { earlyDeloadReasons } from "./deload";
import { planSlot } from "./load";
import { disruptionsIn, seasonFor } from "./seasons";
import {
  actualMuscleSets, adherence, bodyWeightRate, exerciseSessions, finished, gapDays, muscleFeedback, muscleTrend,
  plannedMuscleSets, plannedSessionCount, plannedSoFar, recentPeakSets, sessionsInWeek,
} from "./stats";
import type { CoachInput, CoachNote, CoachPlan, MuscleSuggestion, PlanMode, Reason, SlotSuggestion, SwapSuggestion, Trend } from "./types";
import { bandFor, nextMuscleTarget, startVolume, type Modifiers } from "./volume";

const P = (key: string, params?: Reason["params"]): Reason => ({ key, params });
const trend = (a: number | null, b: number | null): Trend => (a === null || b === null || Math.abs(a - b) < 1e-9 ? "same" : b > a ? "up" : "down");

/** Processing order: prime movers first so secondary credit (e.g. triceps from presses) is counted before they are planned. */
const ORDER: Muscle[] = ["quadriceps", "hamstrings", "glutes", "chest", "lats", "middle-back", "shoulders", "traps", "lower-back", "triceps", "biceps", "forearms", "calves", "abdominals", "adductors", "abductors", "neck"];

/**
 * Plan the next training week. Pure: same input, same output. See README.md for every rule.
 */
export function planNextWeek(input: CoachInput): CoachPlan {
  const cfg = input.config ?? COACH_CONFIG;
  const { program, profile, lookup, today, targetWeekStart } = input;
  const basisWeek = addDays(targetWeekStart, -7);

  const season = seasonFor(addDays(targetWeekStart, 3), profile.region);
  const mods: Modifiers = {
    cfg, exp: cfg.experience[profile.experience], goalMods: cfg.goal[profile.goal], phaseMods: cfg.phase[profile.phase],
    seasonMrv: season?.mrvMult ?? 1, perfTolerance: season?.perfTolerance ?? 1,
    experience: profile.experience, goal: profile.goal, phase: profile.phase,
  };

  const notes: CoachNote[] = [];
  const meso = mesoPosition(program, targetWeekStart);
  const basisMeso = mesoPosition(program, basisWeek);
  const acc = Math.min(8, Math.max(3, program.accumulationWeeks));
  const deloadWeekNo = acc + 1;

  const allDone = finished(input.workouts);
  // Deload-week sessions are intentionally light: they must not drive progression decisions.
  const perfWorkouts = allDone.filter(w => w.mesoWeek !== deloadWeekNo);
  const gap = gapDays(input.workouts, today);

  // ---- Mode ---------------------------------------------------------------
  let mode: PlanMode;
  let deloadType: "scheduled" | "early" | null = null;
  let deloadReasons: Reason[] = [];
  if (allDone.length === 0) mode = "first";
  else if (gap !== null && gap > cfg.gap.rampDays) mode = "ramp";
  else if (meso.isDeload && meso.started) { mode = "deload"; deloadType = "scheduled"; deloadReasons = [P("why.deload.scheduled", { week: meso.week, total: meso.total })]; }
  else {
    const early = meso.week >= cfg.deload.minMesoWeek
      ? earlyDeloadReasons({ perfWorkouts, allWorkouts: input.workouts, soreness: input.soreness, lookup, cfg, tolerance: mods.perfTolerance, today })
      : [];
    if (early.length) { mode = "deload"; deloadType = "early"; deloadReasons = early; }
    else mode = gap !== null && gap > cfg.gap.welcomeBackDays ? "welcome-back" : "normal";
  }

  const newMeso = mode === "first" || mode === "ramp" || (meso.week === 1 && meso.started && (basisMeso.isDeload || basisMeso.cycle < meso.cycle || !basisMeso.started));
  const ladder = cfg.rirLadder[acc] ?? cfg.rirLadder[5];
  // A first plan (or a ramp-in after a long break) is week 1 of a mesocycle whatever the calendar says.
  const mesoWeekEff = mode === "first" || mode === "ramp" ? 1 : meso.week;
  const targetRir = mode === "deload" ? cfg.deload.rir : mode === "ramp" ? cfg.gap.rampRir : ladder[Math.min(ladder.length - 1, Math.max(0, mesoWeekEff - 1))];

  // ---- Context numbers ------------------------------------------------------
  const planned = plannedMuscleSets(program, lookup, cfg);
  const slots = allocSlots(program, lookup);
  const adh = adherence(allDone, program, basisWeek, today);
  const doneN = sessionsInWeek(allDone, basisWeek).length;
  const plannedN = plannedSoFar(program, basisWeek, today);
  const peak = recentPeakSets(allDone, targetWeekStart, 8, deloadWeekNo, lookup, cfg);
  const rate = bodyWeightRate(input.bodyWeights, today, cfg.bodyWeight.window, cfg.bodyWeight.minPoints);
  const cutTooFast = profile.phase === "cut" && rate !== null && rate < -cfg.bodyWeight.cutMaxLossPerWeek;
  const bulkTooFast = profile.phase === "bulk" && rate !== null && rate > cfg.bodyWeight.bulkMaxGainPerWeek;
  const rejectedRecently = (scope: "slot" | "muscle", id: string, kind: "load" | "sets") =>
    input.rejections.some(r => r.scope === scope && r.id === id && r.kind === kind && daysBetween(r.weekKey, targetWeekStart) >= 0 && daysBetween(r.weekKey, targetWeekStart) <= cfg.rejectCooldownWeeks * 7);

  // A deload halves every exercise directly; per-exercise minimums must not stop it.
  if (mode === "deload") for (const a of slots) a.sets = Math.max(1, Math.ceil(a.slot.sets * cfg.deload.volumeFactor));

  // ---- Volume per muscle -------------------------------------------------------
  const trainedMuscles = [...planned.keys()].filter(m => (planned.get(m) ?? 0) > 0).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const muscleRows: MuscleSuggestion[] = [];
  for (const muscle of trainedMuscles) {
    const band = bandFor(muscle, mods);
    const last = planned.get(muscle) ?? 0;
    const hasDirect = slots.some(a => a.mult > 0 && a.exercise.primary.includes(muscle));
    let wanted = last;
    let reason: Reason = P("why.vol.none", { muscle });
    const extra: Reason[] = [];

    if (mode === "deload") { wanted = Math.max(0, Math.ceil(last * cfg.deload.volumeFactor)); reason = P("why.vol.deload", { muscle }); }
    else if (mode === "ramp") { wanted = Math.min(last, Math.max(band.mv, Math.round(band.mev * 0.7))); reason = P("why.vol.ramp", { muscle }); }
    else if (mode === "welcome-back") { wanted = last; reason = P("why.vol.welcome", { muscle }); }
    else if (mode === "first") {
      // No history: respect the program the user chose. Raise muscles below the starting volume, trim only clear excess.
      const start = startVolume(band, undefined, mods);
      if (last < start) { wanted = start; reason = P("why.vol.first", { muscle, n: start }); }
      else if (last > band.mavHigh) { wanted = band.mavHigh; reason = P("why.vol.firstCap", { muscle, n: band.mavHigh }); }
      else { wanted = last; reason = P("why.vol.firstKeep", { muscle, n: last }); }
    }
    else if (newMeso) { wanted = startVolume(band, peak.get(muscle), mods); reason = P("why.vol.start", { muscle, n: wanted }); }
    else {
      const fb = muscleFeedback(allDone, input.soreness, muscle, basisWeek, lookup);
      const d = nextMuscleTarget(muscle, band, {
        last, actual: actualMuscleSets(allDone, basisWeek, lookup, cfg).get(muscle) ?? 0, soreness: fb.soreness, pump: fb.pump, volumeFb: fb.volume, joint: fb.joint,
        trend: muscleTrend(perfWorkouts, muscle, lookup, addDays(basisWeek, -7)), adherence: adh, doneSessions: doneN, plannedSessions: plannedN,
        rejectedRecently: rejectedRecently("muscle", muscle, "sets"),
      }, mods);
      wanted = d.target; reason = d.reason; extra.push(...d.extra);
    }

    if (cutTooFast && mode !== "deload" && wanted > band.mv && wanted >= last) {
      wanted = Math.max(band.mv, Math.min(wanted, last) - 1);
      extra.push(P("why.vol.bwfast", { muscle }));
    }

    let unallocated = 0;
    if (hasDirect && mode !== "deload") {
      const current = realized(slots, cfg).get(muscle) ?? 0;
      const delta = Math.round(wanted - current);
      unallocated = applyDelta(slots, muscle, delta, cfg) * Math.sign(delta);
    }
    if (!hasDirect && Math.round(wanted) > Math.round(last)) extra.push(P("why.vol.noDirect", { muscle, n: Math.round(wanted) }));
    muscleRows.push({ muscle, lastSets: last, newSets: 0, delta: 0, wanted, band, reason, extra, unallocated });
  }
  const real = realized(slots, cfg);
  for (const r of muscleRows) {
    r.newSets = Math.round((real.get(r.muscle) ?? 0) * 10) / 10;
    r.delta = Math.round((r.newSets - r.lastSets) * 10) / 10;
    if (r.unallocated > 0) r.extra.push(P("why.vol.unallocated", { muscle: r.muscle, n: r.unallocated }));
    if (r.wanted === r.lastSets && r.delta !== 0) r.extra.push(P("why.vol.indirect", { muscle: r.muscle }));
    if (r.unallocated < 0) r.extra.push(P("why.vol.unremovable", { muscle: r.muscle, n: -r.unallocated }));
    if (r.newSets > r.band.mrv) r.extra.push(P("why.vol.overMrv", { muscle: r.muscle, mrv: r.band.mrv }));
  }

  // ---- Per-exercise load / reps -----------------------------------------------
  const slotRows: SlotSuggestion[] = [];
  const swaps: SwapSuggestion[] = [];
  for (const a of slots) {
    const sessions = exerciseSessions(perfWorkouts, a.exercise.id);
    const sets = a.mult === 0 && mode !== "deload" ? a.slot.sets : a.sets;
    const plan = planSlot(a.slot, a.exercise, sets, sessions, {
      m: mods, mode, targetRir, unit: profile.weightUnit, restAddSec: season?.restAddSec ?? 0, today, rejectedLoad: rejectedRecently("slot", a.slot.id, "load"), bands: input.bands,
    });
    const lastSession = sessions[sessions.length - 1];
    const lastW = lastSession?.weightKg ?? a.slot.weightKg ?? null;
    const lastReps = lastSession ? Math.round(lastSession.avgReps) : a.slot.repMin;
    slotRows.push({
      sessionId: a.sessionId, slotId: a.slot.id, exerciseId: a.exercise.id,
      last: { sets: a.slot.sets, repMin: a.slot.repMin, repMax: a.slot.repMax, rir: a.slot.rir, restSec: a.slot.restSec, weightKg: lastW, bands: lastSession?.bands ?? a.slot.bands ?? null },
      next: plan.next,
      trend: { sets: trend(a.slot.sets, plan.next.sets), weight: trend(lastW, plan.next.weightKg), reps: trend(lastReps, plan.next.targetReps), rir: trend(a.slot.rir, plan.next.rir) },
      reason: plan.reason, extra: plan.extra,
    });
    if (plan.swapReason) {
      const candidates = input.substitutes(a.exercise).slice(0, 4).map(e => e.id);
      if (candidates.length) swaps.push({ sessionId: a.sessionId, slotId: a.slot.id, exerciseId: a.exercise.id, candidates, reason: plan.swapReason });
    }
  }

  // ---- Notes ----------------------------------------------------------------------
  if (program.sessions.length === 0 || plannedSessionCount(program) === 0) notes.push({ kind: "info", reason: P("why.note.emptyProgram") });
  if (mode === "first") notes.push({ kind: "info", reason: P("why.note.first") });
  if (mode === "ramp") notes.push({ kind: "warn", reason: P("why.note.ramp", { days: gap ?? 0 }) });
  if (mode === "welcome-back") notes.push({ kind: "info", reason: P("why.note.welcome", { days: gap ?? 0 }) });
  if (deloadType === "scheduled") notes.push({ kind: "info", reason: P("why.note.deloadScheduled") });
  if (deloadType === "early") { notes.push({ kind: "warn", reason: P("why.note.deloadEarly") }); for (const r of deloadReasons) notes.push({ kind: "warn", reason: r }); }
  if (adh !== null && adh < cfg.volume.minAdherence && mode === "normal") notes.push({ kind: "warn", reason: P("why.note.adherence", { done: doneN, planned: plannedN }) });
  if (season) for (const n of season.notes) notes.push({ kind: "info", reason: P(`why.${n}`) });
  for (const d of disruptionsIn(targetWeekStart, profile.region)) notes.push({ kind: "info", reason: P(`why.${d.note}`) });
  if (profile.phase === "cut") notes.push({ kind: "good", reason: P("why.note.cut") });
  if (cutTooFast) notes.push({ kind: "warn", reason: P("why.note.cutFast", { pct: Math.round(Math.abs(rate!) * 1000) / 10 }) });
  if (bulkTooFast) notes.push({ kind: "info", reason: P("why.note.bulkFast", { pct: Math.round(rate! * 1000) / 10 }) });

  return {
    targetWeekStart, basisWeekStart: basisWeek,
    meso: { week: mesoWeekEff, total: meso.total, isDeload: mode === "deload", cycle: meso.cycle },
    newMeso, mode, deload: { type: deloadType, reasons: deloadReasons }, targetRir,
    muscles: muscleRows, slots: slotRows, swaps, notes,
  };
}
