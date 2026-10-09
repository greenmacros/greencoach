import type { WeightUnit } from "../db/types";
import type { Exercise } from "../library/types";
import { daysBetween } from "../program/schedule";
import type { ExerciseSlot } from "../program/types";
import { KG_PER_LB, toDisplayWeight } from "../lib/format";
import type { CoachConfig } from "./config";
import { clamp, type SessionPerf } from "./stats";
import type { PlanMode, Reason, SlotState } from "./types";
import type { Modifiers } from "./volume";
import { isBandsOnly, nextBandRange, stepUp } from "../bands/bands";

const P = (key: string, params?: Reason["params"]): Reason => ({ key, params });
const LOWER = ["quadriceps", "hamstrings", "glutes", "lower-back", "calves"];

export const isAssisted = (ex: Exercise) => /assisted/i.test(ex.name.en);
const isBodyweightOnly = (ex: Exercise) => ex.equipment.every(e => ["bodyweight", "pullup-bar", "dip-bars", "trx", "bench"].includes(e));

/** Smallest sensible jump in kg for this exercise at this weight; null when weight is not the progression axis (bands). */
export function increment(ex: Exercise, weightKg: number, unit: WeightUnit, cfg: CoachConfig): number | null {
  if (isBandsOnly(ex)) return null;
  const t = unit === "lb" ? cfg.load.incLb : cfg.load.inc;
  const toKg = (v: number) => (unit === "lb" ? v * KG_PER_LB : v);
  const eq = ex.equipment;
  const lower = LOWER.includes(ex.primary[0]);
  let v: number;
  if (eq.includes("smith")) v = t.smith;
  else if (eq.includes("barbell") || eq.includes("landmine")) v = lower && weightKg >= cfg.load.lowerHeavyKg ? t.barbellLower : t.barbell;
  else if (eq.includes("ez-bar")) v = t.ezBar;
  else if (eq.includes("dumbbell")) v = weightKg < cfg.load.dumbbellLightBelowKg ? t.dumbbellLight : t.dumbbell;
  else if (eq.includes("kettlebell")) v = t.kettlebell;
  else if (eq.includes("machine")) v = weightKg >= cfg.load.machineHeavyKg ? t.machineHeavy : t.machine;
  else if (eq.includes("cable")) v = t.cable;
  else if (isBodyweightOnly(ex)) v = t.bodyweightLoad;
  else v = t.cable;
  return toKg(v);
}

/** Round to the nearest half increment so suggested weights are loadable. */
export const roundTo = (w: number, inc: number) => Math.max(0, Math.round(w / (inc / 2)) * (inc / 2));

export interface LoadCtx {
  m: Modifiers;
  mode: PlanMode;
  targetRir: number;
  unit: WeightUnit;
  restAddSec: number;
  today: string;
  rejectedLoad: boolean;
  /** The user's bands, lightest first. */
  bands?: readonly { id: string; name: string; kg?: number | null }[];
  /** Heaviest dumbbell the user owns (kg). */
  dumbbellMaxKg?: number | null;
}

/** A dumbbell exercise whose load is the dumbbells (not a barbell or machine that also lists them). */
const isDumbbellLoad = (ex: Exercise) => ex.equipment.includes("dumbbell") && !ex.equipment.some(e => ["barbell", "smith", "machine", "cable", "ez-bar"].includes(e));

export interface SlotPlan { next: SlotState & { targetReps: number }; reason: Reason; extra: Reason[]; swapReason?: Reason }

/** Rep range after goal rules: strength focus lowers the range of the main compound lifts. */
export function effectiveRange(slot: ExerciseSlot, ex: Exercise, m: Modifiers): { min: number; max: number; changed: boolean } {
  const s = m.cfg.strength;
  if (m.goalMods.strengthRanges && ex.mechanic !== "isolation") {
    if (s.mainPatterns.includes(ex.pattern) && slot.repMax > s.compoundRange[1]) return { min: s.compoundRange[0], max: s.compoundRange[1], changed: true };
  } else if (m.goalMods.strengthRanges && ex.mechanic === "isolation" && slot.repMax > s.isolationRange[1] + 8) {
    return { min: s.isolationRange[0], max: s.isolationRange[1], changed: true };
  }
  return { min: slot.repMin, max: slot.repMax, changed: false };
}

function restFor(slot: ExerciseSlot, ex: Exercise, ctx: LoadCtx): number {
  const cfg = ctx.m.cfg;
  const base = ex.mechanic === "isolation" ? cfg.rest.isolationSec : cfg.rest.compoundSec;
  let r = Math.max(slot.restSec, base + ctx.restAddSec); // idempotent: a value already accepted is not added to again
  if (ctx.m.goalMods.strengthRanges && ex.mechanic !== "isolation" && cfg.strength.mainPatterns.includes(ex.pattern)) r = Math.max(r, cfg.strength.compoundRestSec + ctx.restAddSec);
  return Math.max(cfg.rest.minSec, r);
}

export function planSlot(slot: ExerciseSlot, ex: Exercise, newSets: number, sessions: readonly SessionPerf[], ctx: LoadCtx): SlotPlan {
  const { m, mode } = ctx;
  const cfg = m.cfg;
  const range = effectiveRange(slot, ex, m);
  const restSec = restFor(slot, ex, ctx);
  const last = sessions[sessions.length - 1];
  const extra: Reason[] = [];
  if (range.changed) extra.push(P("why.load.strengthRange", { lo: range.min, hi: range.max }));
  if (restSec > slot.restSec) extra.push(P("why.rest.longer", { t: `${Math.floor(restSec / 60)}:${String(restSec % 60).padStart(2, "0")}` }));

  const base = { sets: newSets, repMin: range.min, repMax: range.max, restSec };
  const lastBands = last?.bands ?? slot.bands ?? null;
  // Long band sets (top of range 20+) only count when close to failure, and people under-guess reps left on them.
  const dbMax = isDumbbellLoad(ex) ? ctx.dumbbellMaxKg ?? null : null;
  const atDbMax = dbMax !== null && last?.weightKg != null && last.weightKg >= dbMax - 1e-6;
  const rirCap = (isBandsOnly(ex) || atDbMax) && range.max >= 20 ? 1 : Infinity;
  const mk = (weightKg: number | null, rir: number, targetReps: number, reason: Reason, swapReason?: Reason, bands: string[] | null = lastBands): SlotPlan =>
    ({ next: { ...base, rir: Math.min(rir, rirCap), weightKg, targetReps: clamp(Math.round(targetReps), range.min, range.max), bands }, reason, extra, swapReason });

  // --- No usable history -------------------------------------------------
  if (!last) return mk(slot.weightKg ?? null, ctx.targetRir, range.min, P("why.load.first", { lo: range.min, hi: range.max, rir: ctx.targetRir }));

  const lastW = last.weightKg;
  const inc = lastW !== null ? increment(ex, lastW, ctx.unit, cfg) : increment(ex, 0, ctx.unit, cfg);
  const dir = isAssisted(ex) ? -1 : 1;
  const wRound = (w: number) => (inc ? roundTo(w, inc) : w);
  const fmt = (kg: number) => Math.round(toDisplayWeight(kg, ctx.unit) * 100) / 100;
  const daysSince = daysBetween(last.dayKey, ctx.today);

  // --- Mode overrides ------------------------------------------------------
  if (mode === "deload") {
    const w = lastW === null ? null : wRound(lastW * cfg.deload.loadFactor);
    return mk(w, cfg.deload.rir, last.avgReps, P("why.load.deload", { pct: Math.round((1 - cfg.deload.loadFactor) * 100), rir: cfg.deload.rir }));
  }
  if (mode === "ramp") {
    const w = lastW === null ? null : wRound(lastW * cfg.gap.rampLoadFactor);
    return mk(w, cfg.gap.rampRir, range.min, P("why.load.ramp", { pct: Math.round((1 - cfg.gap.rampLoadFactor) * 100) }));
  }
  if (mode === "welcome-back" || daysSince > cfg.load.staleDays) {
    const g = cfg.gap;
    const f = g.loadFactorStart + (g.loadFactorEnd - g.loadFactorStart) * clamp((Math.max(daysSince, g.welcomeBackDays) - g.welcomeBackDays) / (g.rampDays - g.welcomeBackDays), 0, 1);
    const w = lastW === null ? null : wRound(lastW * f);
    return mk(w, ctx.targetRir, last.avgReps, P(mode === "welcome-back" ? "why.load.welcome" : "why.load.stale", { pct: Math.round((1 - f) * 100), days: daysSince }));
  }

  // --- Normal progression ----------------------------------------------------
  const lastT = last.log.target?.rir ?? slot.rir;
  const avgRir = last.avgRir;
  const shortfall = avgRir === null ? 0 : lastT - avgRir; // > 0: harder than planned
  const surplus = avgRir === null ? 0 : avgRir - lastT;   // > 0: easier than planned
  const joint = last.log.jointPain ?? 0;
  const diff = last.log.difficulty;
  const tolRir = cfg.load.rirGap + (m.perfTolerance > 1 ? 1 : 0);
  const belowGap = cfg.load.belowRangeRepsGap * (m.perfTolerance > 1 ? 1.5 : 1);
  const atTop = last.sets.every(s => s.reps! >= range.max);
  const below = last.avgReps < range.min;
  const cutMode = m.phaseMods.loadDropTolerance > 0;
  const keep = lastW;

  let plateau = false;
  if (sessions.length >= cfg.load.plateauSessions) {
    const recent = sessions.slice(-cfg.load.plateauSessions);
    plateau = (recent[recent.length - 1].e1rm - recent[0].e1rm) / Math.max(1, recent[0].e1rm) < cfg.load.plateauGain;
  }
  const withPlateau = (p: SlotPlan): SlotPlan => {
    if (!plateau) return p;
    return { ...p, extra: [...p.extra, P("why.load.plateau", { n: cfg.load.plateauSessions })], swapReason: p.swapReason ?? P("why.swap.plateau") };
  };

  // 1. Joint pain overrides everything.
  if (joint >= cfg.load.jointDrop) return mk(keep === null ? null : wRound(keep * cfg.load.jointDropFactor), ctx.targetRir, range.min, P("why.load.drop.joint", { pct: Math.round((1 - cfg.load.jointDropFactor) * 100) }), P("why.swap.joint"));
  if (joint >= cfg.load.jointHold) return mk(keep, ctx.targetRir, last.avgReps, P("why.load.hold.joint"), P("why.swap.joint"));

  // 2. Much harder than planned: back off.
  const hardNote = shortfall >= tolRir + (cutMode ? 1 : 0) || (diff !== undefined && diff >= cfg.load.difficultyHard && shortfall >= 1 && !cutMode);
  if (hardNote && keep !== null) {
    const pct = shortfall >= tolRir + 1 ? cfg.load.backoffMax : cfg.load.backoffMin;
    return withPlateau(mk(wRound(keep * (1 - pct)), ctx.targetRir, range.min, P("why.load.back.rir", { rir: Math.round((avgRir ?? 0) * 10) / 10, target: lastT, pct: Math.round(pct * 1000) / 10 })));
  }

  // 3. Below the rep range.
  if (below) {
    const gap = range.min - last.avgReps;
    const severe = gap >= belowGap || (avgRir !== null && avgRir <= 0 && gap >= 1);
    const dropAllowed = severe && (!cutMode || gap >= belowGap * 2);
    if (dropAllowed && keep !== null) {
      const pct = cfg.load.backoffMin;
      return withPlateau(mk(wRound(keep * (1 - pct)), ctx.targetRir, range.min, P("why.load.back.below", { lo: range.min, pct: Math.round(pct * 1000) / 10 })));
    }
    return withPlateau(mk(keep, ctx.targetRir, range.min, cutMode ? P("why.load.hold.cut") : P("why.load.hold.below", { lo: range.min })));
  }

  // 4. Progress the load.
  const bigSurplus = surplus >= tolRir && last.avgReps >= range.min;
  let steps = 0;
  if (bigSurplus) steps = 2;
  else if (atTop && (avgRir === null || shortfall <= 1)) steps = 1;
  else if (m.experience === "beginner" && last.avgReps >= range.min && (avgRir === null ? last.avgReps >= (range.min + range.max) / 2 : surplus >= 0)) steps = 1;
  if (steps > 0 && diff !== undefined && diff <= cfg.load.difficultyEasy) steps += 1;
  if (steps > 0 && surplus >= 1) steps += m.phaseMods.loadBonusSteps;
  steps = Math.min(steps, m.exp.maxLoadSteps + (bigSurplus ? 1 : 0));

  if (steps > 0) {
    if (ctx.rejectedLoad) return withPlateau(mk(keep, ctx.targetRir, last.avgReps + 1, P("why.load.hold.rejected")));
    if (inc === null) {
      // Bands: one band up in the user's own order; on the heaviest band, slow down or add a second band.
      const order = ctx.bands ?? [];
      const up = stepUp(lastBands, order);
      const names = (ids: string[]) => order.filter(b => ids.includes(b.id)).map(b => b.name).join(" + ");
      if (up) return withPlateau(mk(null, ctx.targetRir, range.min, P(up.length > 1 || (lastBands?.length ?? 0) > 1 ? "why.load.bandCombo" : "why.load.bandNext", { band: names(up) }), undefined, up));
      if (!lastBands?.length || !lastBands.every(id => order.some(b => b.id === id))) return withPlateau(mk(null, ctx.targetRir, range.min, P("why.load.bands")));
      // Nothing stronger to move to: raise the rep range (to 30 at most), with sets close to failure.
      const kgHint = order.length > 1 && order.some(b => b.kg == null) ? [P("why.load.bandKgHint")] : [];
      const wider = nextBandRange(range.max);
      if (wider) {
        return {
          next: { ...base, repMin: wider.min, repMax: wider.max, rir: Math.min(ctx.targetRir, 1), weightKg: null, targetReps: wider.min, bands: lastBands },
          reason: P("why.load.bandReps", { lo: wider.min, hi: wider.max }), extra: [...extra, ...kgHint],
        };
      }
      return { ...mk(null, Math.min(ctx.targetRir, 1), range.max, P("why.load.bandOutgrown", { n: range.max }), P("why.swap.bandOutgrown")), extra: [...extra, ...kgHint] };
    }
    if (keep === null) return withPlateau(mk(inc, ctx.targetRir, range.min, P("why.load.bw", { inc: fmt(inc), u: ctx.unit })));
    if (dbMax !== null && keep + inc * steps > dbMax + 1e-6) {
      // Never above the heaviest dumbbell the user has: go up to it, then add reps (to 30 at most, near failure).
      if (keep < dbMax - 1e-6) return withPlateau(mk(dbMax, ctx.targetRir, range.min, P("why.load.dbCap", { w: fmt(dbMax), u: ctx.unit })));
      const wider = nextBandRange(range.max);
      if (wider) return { next: { ...base, repMin: wider.min, repMax: wider.max, rir: Math.min(ctx.targetRir, 1), weightKg: keep, targetReps: wider.min, bands: lastBands }, reason: P("why.load.dbReps", { w: fmt(dbMax), u: ctx.unit, lo: wider.min, hi: wider.max }), extra };
      return { ...mk(keep, Math.min(ctx.targetRir, 1), range.max, P("why.load.dbOutgrown", { w: fmt(dbMax), u: ctx.unit }), P("why.swap.dbOutgrown")), extra };
    }
    const w = wRound(keep + dir * inc * steps);
    const key = bigSurplus ? "why.load.up2" : "why.load.up";
    return withPlateau(mk(w, ctx.targetRir, range.min, P(key, { reps: Math.round(last.avgReps), rir: avgRir === null ? "–" : Math.round(avgRir * 10) / 10, inc: fmt(Math.abs(w - keep)), u: ctx.unit })));
  }

  // 5. In range, not at the top: same weight, one more rep.
  const target = Math.min(range.max, Math.round(last.avgReps) + 1);
  return withPlateau(mk(keep, ctx.targetRir, target, P("why.load.hold.reps", { avg: Math.round(last.avgReps * 10) / 10, target })));
}
