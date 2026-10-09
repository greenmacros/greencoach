import { useMemo } from "react";
import { useApp } from "../app-context";
import { formatDayLong, fmtWeight } from "../lib/format";
import type { Exercise } from "../library/types";
import { estimate1RM, isWorkingSet } from "../workout/model";
import { computeAllPRs } from "../workout/pr";
import { prText } from "../workout/prText";
import type { SetLog, WorkoutLog } from "../workout/types";
import Icon from "./Icon";

const setText = (s: SetLog, unit: "kg" | "lb") => `${s.weightKg != null ? fmtWeight(s.weightKg, unit) + "×" : ""}${s.reps}`;

/** Every finished session of one exercise, with notes, feedback and PRs. */
export default function ExerciseHistory({ ex, workouts, onClose }: { ex: Exercise; workouts: WorkoutLog[]; onClose: () => void }) {
  const { t, settings } = useApp();
  const lang = settings.lang, unit = settings.weightUnit;
  const prs = useMemo(() => computeAllPRs(workouts), [workouts]);

  const sessions = useMemo(
    () => workouts.filter(w => w.finishedAt && w.exercises.some(e => e.exerciseId === ex.id && e.sets.some(isWorkingSet))).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [workouts, ex.id],
  );
  const allSets = sessions.flatMap(w => w.exercises.filter(e => e.exerciseId === ex.id).flatMap(e => e.sets.filter(isWorkingSet)));
  const bestWeight = Math.max(0, ...allSets.map(s => s.weightKg ?? 0));
  const bestE1 = Math.max(0, ...allSets.map(s => (s.weightKg ? estimate1RM(s.weightKg, s.reps!) : 0)));

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={`${t("hist.exHistory")}: ${ex.name[lang]}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{ex.name[lang]}</h2>
            <p className="muted text-sm">{t("hist.exHistory")} · {t("hist.sessions", { n: sessions.length })}</p>
          </div>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}><Icon name="close" /></button>
        </div>
        {sessions.length === 0 ? <p className="muted">{t("hist.noHistory")}</p> : (
          <>
            {bestWeight > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-center">
                <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("hist.bestWeight")}</dt><dd className="font-bold">{fmtWeight(bestWeight, unit)} {unit}</dd></div>
                <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("hist.bestE1rm")}</dt><dd className="font-bold">{fmtWeight(bestE1, unit)} {unit}</dd></div>
              </dl>
            )}
            <ol className="grid gap-2">
              {sessions.map(w => {
                const logs = w.exercises.filter(e => e.exerciseId === ex.id);
                const sets = logs.flatMap(e => e.sets.filter(isWorkingSet));
                const top = [...sets].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
                const myPrs = (prs.get(w.id) ?? []).filter(p => p.exerciseId === ex.id);
                const notes = logs.map(l => l.notes).filter(Boolean).join(" · ");
                return (
                  <li key={w.id} className="card grid gap-1" style={{ padding: 12 }}>
                    <p className="font-semibold">{formatDayLong(w.dayKey, lang)}</p>
                    <p className="text-sm">{sets.map(s => setText(s, unit)).join(", ")}</p>
                    {top && <p className="muted text-sm">{t("hist.topSet")}: {setText(top, unit)}{top.weightKg ? ` · e1RM ${fmtWeight(estimate1RM(top.weightKg, top.reps!), unit)} ${unit}` : ""}</p>}
                    {myPrs.length > 0 && <p className="text-sm"><Icon name="trophy" /> {[...new Set(myPrs.map(p => prText(p, unit, t)))].join(" · ")}</p>}
                    {notes && <p className="muted text-sm"><Icon name="note" /> {notes}</p>}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
