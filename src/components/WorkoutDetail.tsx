import { useMemo, useState } from "react";
import { useApp } from "../app-context";
import { formatClock, formatDayLong, fmtWeight } from "../lib/format";
import type { Exercise, Muscle } from "../library/types";
import { summarize } from "../workout/model";
import { computeAllPRs } from "../workout/pr";
import { prText } from "../workout/prText";
import type { WorkoutLog } from "../workout/types";
import Icon from "./Icon";

interface Props {
  workout: WorkoutLog;
  workouts: WorkoutLog[];
  lookup: (id: string) => Exercise | undefined;
  onClose: () => void;
  onDelete: (w: WorkoutLog) => void;
  onExercise: (ex: Exercise) => void;
  /** Open this session for editing (sets, weights, reps, exercises, date). */
  onEdit?: (w: WorkoutLog) => void;
}

export default function WorkoutDetail({ workout, workouts, lookup, onClose, onDelete, onExercise, onEdit }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang, unit = settings.weightUnit;
  const [confirm, setConfirm] = useState(false);
  const prs = useMemo(() => computeAllPRs(workouts).get(workout.id) ?? [], [workouts, workout.id]);
  const s = summarize(workout, lookup);
  const muscles = (Object.entries(s.muscleSets) as [Muscle, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("hist.detail")} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{workout.sessionName || t("wk.quick")}</h2>
            <p className="muted text-sm">{formatDayLong(workout.dayKey, lang)}</p>
          </div>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}><Icon name="close" /></button>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumDuration")}</dt><dd className="font-bold">{formatClock(s.durationSec)}</dd></div>
          <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumVolume")}</dt><dd className="font-bold">{fmtWeight(s.volumeKg, unit)} {unit}</dd></div>
          <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumSets")}</dt><dd className="font-bold">{s.workingSets}</dd></div>
        </dl>
        {workout.sleep && <p className="text-sm muted">{t("sleep.label", { v: t(`sleep.${workout.sleep}`) })}</p>}
        {(workout.feel || workout.sessionFatigue) && (
          <p className="text-sm muted">{t("hist.sessionFeel", { feel: workout.feel ? t(`fb.feel.${workout.feel}`) : "–", fatigue: workout.sessionFatigue ? t(`fb.fatigue.${workout.sessionFatigue}`) : "–" })}</p>
        )}
        {muscles.length > 0 && <ul className="flex flex-wrap gap-1.5">{muscles.map(([m, n]) => <li key={m} className="chip" style={{ cursor: "default" }}>{t(`muscle.${m}`)} {n}</li>)}</ul>}
        {workout.notes && <p className="card"><strong>{t("hist.notes")}:</strong> {workout.notes}</p>}

        {workout.exercises.map(e => {
          const ex = lookup(e.exerciseId);
          const myPrs = new Set(prs.filter(p => p.exerciseId === e.exerciseId).map(p => p.setId));
          return (
            <article key={e.id} className="card grid gap-1" style={{ padding: 12 }}>
              <button className="text-left font-bold bg-transparent border-0 p-0 cursor-pointer underline" style={{ color: "var(--text)", font: "inherit", fontWeight: 700 }}
                disabled={!ex} onClick={() => ex && onExercise(ex)}>{ex ? ex.name[lang] : t("prog.missing")}</button>
              <ol className="grid gap-0.5 text-sm">
                {e.sets.map((set, i) => (
                  <li key={set.id} className="flex gap-2">
                    <span className="muted w-6">{i + 1}</span>
                    <span>{set.weightKg != null ? `${fmtWeight(set.weightKg, unit)} ${unit} × ` : ""}{set.reps}{set.rir != null ? ` @${set.rir}` : ""}</span>
                    {set.type !== "normal" && <span className="muted">· {t(`wk.type.${set.type}`)}</span>}
                    {myPrs.has(set.id) && <Icon name="trophy" label={t("pr.badge")} />}
                  </li>
                ))}
              </ol>
              {(e.difficulty !== undefined || e.pump !== undefined || e.jointPain !== undefined) && (
                <p className="muted text-xs">
                  {[e.difficulty !== undefined && `${t("fb.difficulty")}: ${t(`fb.diff.${e.difficulty}`)}`, e.pump !== undefined && `${t("fb.pump")}: ${t(`fb.pump.${e.pump}`)}`, e.jointPain !== undefined && `${t("fb.joint")}: ${t(`fb.joint.${e.jointPain}`)}`].filter(Boolean).join(" · ")}
                </p>
              )}
              {e.notes && <p className="muted text-sm"><Icon name="note" /> {e.notes}</p>}
            </article>
          );
        })}

        {prs.length > 0 && (
          <div><p className="font-semibold"><Icon name="trophy" /> {t("pr.title")}</p>
            <ul className="text-sm grid gap-0.5">{prs.map((p, i) => <li key={i}>{lookup(p.exerciseId)?.name[lang]}: {prText(p, unit, t)}</li>)}</ul>
          </div>
        )}

        {confirm ? (
          <div className="flex gap-2">
            <button className="btn btn-danger flex-1" onClick={() => onDelete(workout)}>{t("hist.delete")}</button>
            <button className="btn flex-1" onClick={() => setConfirm(false)}>{t("data.cancel")}</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onEdit && <button className="btn btn-primary" onClick={() => onEdit(workout)}>{t("hist.edit")}</button>}
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>{t("hist.delete")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
