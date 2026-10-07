import type { Experience, Goal, Phase } from "../db/types";
import type { Muscle } from "../library/types";
import type { CoachConfig, ExperienceMods } from "./config";
import type { Band, Reason } from "./types";
import { clamp } from "./stats";

export interface Modifiers {
  cfg: CoachConfig;
  exp: ExperienceMods;
  goalMods: CoachConfig["goal"][Goal];
  phaseMods: CoachConfig["phase"][Phase];
  /** From the season table. */
  seasonMrv: number;
  perfTolerance: number;
  experience: Experience;
  goal: Goal;
  phase: Phase;
}

/** Landmarks for a muscle after experience, goal, phase and season scaling (kept monotonic). */
export function bandFor(muscle: Muscle, m: Modifiers): Band {
  const L = m.cfg.landmarks[muscle];
  const mev = Math.round(L.mev * m.exp.mev);
  const mavLow = Math.max(mev, Math.round(L.mavLow * m.exp.mav * m.goalMods.mavMult));
  const mavHigh = Math.max(mavLow, Math.round(L.mavHigh * m.exp.mav * m.goalMods.mavMult));
  const mrv = Math.max(mavHigh, Math.round(L.mrv * m.exp.mrv * m.goalMods.mrvMult * m.phaseMods.mrvMult * m.seasonMrv));
  return { mv: Math.min(L.mv, mev), mev, mavLow, mavHigh, mrv };
}

/** The most volume we are willing to climb to without strong "add more" signals. */
export const softCap = (b: Band, m: Modifiers) => Math.round(b.mev + m.goalMods.volumeFocus * (b.mavHigh - b.mev));

/** Week 1 of a mesocycle: near MEV, adjusted by what this person recently handled. */
export function startVolume(b: Band, peak: number | undefined, m: Modifiers): number {
  const mavMid = (b.mavLow + b.mavHigh) / 2;
  let v = b.mev + m.exp.startBonus;
  if (peak !== undefined && peak >= b.mev) v = Math.max(b.mev, Math.min(Math.round(peak * 0.7), Math.round(mavMid)));
  return clamp(v, b.mev, Math.max(b.mev, Math.min(softCap(b, m), b.mrv)));
}

export interface VolumeSignals {
  last: number;
  /** Actual weighted sets done last week. */
  actual: number;
  soreness: number | null;
  pump: number | null;
  volumeFb: number | null;
  joint: number;
  /** Fractional e1RM change for this muscle's lifts, null if unknown. */
  trend: number | null;
  adherence: number | null;
  doneSessions: number;
  plannedSessions: number;
  rejectedRecently: boolean;
}

export interface VolumeDecision { target: number; reason: Reason; extra: Reason[] }

const P = (key: string, params: Reason["params"]): Reason => ({ key, params });

/** Weekly set change for one muscle in an accumulation week (week 2+). Order matters: safety first. */
export function nextMuscleTarget(muscle: Muscle, b: Band, s: VolumeSignals, m: Modifiers): VolumeDecision {
  const v = m.cfg.volume;
  const name = muscle;
  const tol = m.perfTolerance;
  const step = (n: number) => Math.min(n, m.exp.maxSetStep);
  const last = s.last;
  const hold = (reason: Reason): VolumeDecision => ({ target: last, reason, extra: [] });
  const perfDown = s.trend !== null && s.trend <= v.perfDrop * tol;
  const sc = softCap(b, m);

  // 1. Joint safety.
  if (s.joint >= v.jointCut) return { target: Math.max(0, last - 2), reason: P("why.vol.cut.joint", { muscle: name, n: Math.max(0, last - 2) }), extra: [] };
  if (s.joint >= v.jointHold) return hold(P("why.vol.hold.joint", { muscle: name, n: last }));

  // 2. Recoverable ceiling.
  if (last > b.mrv) return { target: b.mrv, reason: P("why.vol.cut.mrv", { muscle: name, mrv: b.mrv }), extra: [] };
  if (last >= b.mrv) return hold(P("why.vol.hold.mrv", { muscle: name, mrv: b.mrv, n: last }));

  // 3. Recovery problems.
  const stillSore = s.soreness !== null && s.soreness >= v.soreHigh;
  if (stillSore && perfDown) {
    const n = s.volumeFb !== null && s.volumeFb >= v.volumeTooMuch ? 2 : 1;
    return { target: Math.max(0, last - n), reason: P("why.vol.cut.sore", { muscle: name, n }), extra: [] };
  }
  if (s.volumeFb !== null && s.volumeFb >= v.volumeTooMuch) return { target: Math.max(0, last - 1), reason: P("why.vol.cut.toomuch", { muscle: name }), extra: [] };
  if (stillSore) return hold(P("why.vol.hold.sore", { muscle: name, n: last }));
  if (perfDown) return hold(P("why.vol.hold.perf", { muscle: name, n: last }));

  // 4. Context that blocks increases.
  const belowMev = last < b.mev;
  if (s.adherence !== null && s.adherence < v.minAdherence) {
    return hold(P("why.vol.hold.adherence", { muscle: name, done: s.doneSessions, planned: s.plannedSessions }));
  }
  if (s.rejectedRecently) return hold(P("why.vol.hold.rejected", { muscle: name, n: last }));
  if (m.phaseMods.holdVolume && !belowMev) return hold(P("why.vol.hold.cut", { muscle: name, n: last }));

  // 5. Add sets.
  const recovered = s.soreness !== null && s.soreness <= v.soreOk;
  const lowPump = s.pump !== null && s.pump <= v.pumpLow;
  const notEnough = s.volumeFb !== null && s.volumeFb <= v.volumeNotEnough;
  const goodPump = s.pump !== null && s.pump >= v.pumpHigh;
  const justInTime = s.soreness !== null && s.soreness > v.soreOk && s.soreness < v.soreHigh;

  const add = (n: number, reason: Reason, cap: number): VolumeDecision => {
    const t = Math.min(last + step(n), cap);
    return t > last ? { target: t, reason: { ...reason, params: { ...reason.params, n: t - last } }, extra: [] } : hold(P("why.vol.hold.cap", { muscle: name, n: last }));
  };
  if (recovered && (lowPump || notEnough)) return add(v.bigStep, P("why.vol.add.recovered", { muscle: name }), b.mrv);
  if (belowMev) return add(v.smallStep, P("why.vol.add.mev", { muscle: name, mev: b.mev }), b.mev);
  if (justInTime && goodPump) return add(v.smallStep, P("why.vol.add.good", { muscle: name }), sc);
  if (last >= sc) return hold(P("why.vol.hold.cap", { muscle: name, n: last }));
  return add(v.smallStep, P("why.vol.add.default", { muscle: name, mav: b.mavHigh }), sc);
}
