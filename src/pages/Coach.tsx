import { useApp } from "../app-context";
import CoachSlotCard from "../components/CoachSlotCard";
import { explain } from "../coach/explain";
import { useCoach } from "../coach/useCoach";
import type { WorkoutLog } from "../workout/types";
import { formatDayKey } from "../lib/format";
import type { LibraryApi } from "../library/useLibrary";
import type { ProgramApi } from "../program/useProgram";
import type { Trend } from "../coach/types";

const COLOR: Record<Trend, string> = { up: "var(--accent)", down: "var(--danger)", same: "var(--muted)" };
const NOTE_ICON = { info: "ℹ️", warn: "⚠️", good: "✅" } as const;

export default function Coach({ prog, lib, finished }: { prog: ProgramApi; lib: LibraryApi; finished: WorkoutLog[] }) {
  const coach = useCoach(prog, lib, finished);
  const { t, settings, profile } = useApp();
  const lang = settings.lang;
  const plan = coach.plan;

  if (!prog.ready || !coach.ready) return null;
  if (!prog.active || !plan) {
    return (
      <section className="grid gap-3">
        <h1 className="text-2xl font-bold">{t("coach.title")}</h1>
        <p className="card muted">{t("coach.empty")}</p>
      </section>
    );
  }

  const sessions = (prog.programs.find(p => p.id === prog.active!.id) ?? prog.active).sessions;
  const sessionName = (id: string) => sessions.find(s => s.id === id)?.name ?? "";
  const bySession = new Map<string, typeof plan.slots>();
  for (const s of plan.slots) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const pending = plan.slots.filter(s => !coach.decided.has(s.slotId)).length;

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">{coach.target === "this" ? t("coach.titleThis") : t("coach.title")}</h1>
        <p className="muted">{t("coach.for", { date: formatDayKey(plan.targetWeekStart, lang, { month: "short", day: "numeric" }) })}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="chip" style={{ cursor: "default" }}>{t("coach.mesoWeek", { w: plan.meso.week, t: plan.meso.total })}</span>
          <span className="chip" aria-pressed="true" style={{ cursor: "default" }}>{t(`coach.mode.${plan.mode}`)}</span>
          <span className="chip" style={{ cursor: "default" }}>{t("coach.targetRir", { n: plan.targetRir })}</span>
        </div>
        <p className="muted text-sm mt-1">{t("coach.goalHint", { goal: t(`profile.goal.${profile.goal}`), phase: t(`profile.phase.${profile.phase}`) })}</p>
      </div>

      <div className="seg" role="group" aria-label={t("coach.title")}>
        <button aria-pressed={coach.target === "this"} onClick={() => coach.setTarget("this")}>{t("coach.thisWeek")}</button>
        <button aria-pressed={coach.target === "next"} onClick={() => coach.setTarget("next")}>{t("coach.nextWeek")}</button>
      </div>

      {plan.notes.length > 0 && (
        <ul className="grid gap-2" aria-label={t("coach.notes")}>
          {plan.notes.map((n, i) => (
            <li key={i} className="card text-sm flex gap-2" style={{ borderColor: n.kind === "warn" ? "var(--danger)" : undefined }}>
              <span aria-hidden="true">{NOTE_ICON[n.kind]}</span><span>{explain(n.reason, t)}</span>
            </li>
          ))}
        </ul>
      )}
      {plan.deload.type === "early" && <p className="muted text-sm">{t("coach.applyDeload")}</p>}

      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={pending === 0} onClick={() => void coach.acceptAll()}>{t("coach.acceptAll")}</button>
        {coach.decided.size > 0 && <button className="btn" onClick={() => void coach.reset()}>↺</button>}
      </div>

      <div className="grid gap-2">
        <h2 className="font-bold text-lg">{t("coach.muscles")}</h2>
        {plan.muscles.map(m => {
          const trend: Trend = m.delta > 0 ? "up" : m.delta < 0 ? "down" : "same";
          return (
            <div key={m.muscle} className="card grid gap-1" style={{ padding: 12 }} aria-label={t(`muscle.${m.muscle}`)}>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold flex-1">{t(`muscle.${m.muscle}`)}</span>
                <span className="muted text-sm">{m.lastSets} →</span>
                <span className="font-bold" style={{ color: COLOR[trend] }}>{trend === "up" ? "▲" : trend === "down" ? "▼" : "="} {m.newSets}</span>
              </div>
              <p className="text-sm">{explain(m.reason, t)}</p>
              {m.extra.map((r, i) => <p key={i} className="muted text-xs">{explain(r, t)}</p>)}
              <p className="muted text-xs">{t("coach.band", { mev: m.band.mev, mrv: m.band.mrv })}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3">
        <h2 className="font-bold text-lg">{t("coach.exercises")}</h2>
        {[...bySession.entries()].map(([sid, slots]) => (
          <div key={sid} className="grid gap-2">
            <h3 className="font-semibold muted">{sessionName(sid)}</h3>
            {slots.map(s => (
              <CoachSlotCard key={s.slotId} s={s} lib={lib} decided={coach.decided.get(s.slotId)} swap={plan.swaps.find(x => x.slotId === s.slotId)}
                onAccept={swapTo => void coach.accept(s.slotId, swapTo)} onReject={() => void coach.reject(s.slotId)} onEdit={v => void coach.edit(s.slotId, v)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
