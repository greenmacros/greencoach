import { useApp } from "../app-context";
import { formatClock, fmtWeight } from "../lib/format";
import type { Exercise, Muscle } from "../library/types";
import { hasAnyDoneSet, summarize } from "../workout/model";
import type { WorkoutLog } from "../workout/types";

interface Props {
  workout: WorkoutLog;
  lookup: (id: string) => Exercise | undefined;
  onSave: (notes: string) => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
  onKeepGoing: () => void;
  onNotes: (notes: string) => void;
}

export default function FinishSheet({ workout, lookup, onSave, onDiscard, onKeepGoing, onNotes }: Props) {
  const { t, settings } = useApp();
  const any = hasAnyDoneSet(workout);
  const s = summarize(workout, lookup);
  const unfinished = workout.exercises.reduce((n, e) => n + e.sets.filter(x => !x.done).length, 0);
  const muscles = (Object.entries(s.muscleSets) as [Muscle, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="sheet" onClick={onKeepGoing}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("wk.finishTitle")} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{t("wk.finishTitle")}</h2>
        {!any ? (
          <>
            <p>{t("wk.finishEmpty")}</p>
            <div className="flex gap-2">
              <button className="btn btn-danger flex-1" onClick={() => void onDiscard()}>{t("wk.discard")}</button>
              <button className="btn btn-primary flex-1" onClick={onKeepGoing}>{t("wk.keepGoing")}</button>
            </div>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumDuration")}</dt><dd className="font-bold">{formatClock(s.durationSec)}</dd></div>
              <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumVolume")}</dt><dd className="font-bold">{fmtWeight(s.volumeKg, settings.weightUnit).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} {settings.weightUnit}</dd></div>
              <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("wk.sumSets")}</dt><dd className="font-bold">{s.workingSets}</dd></div>
            </dl>
            {muscles.length > 0 && (
              <div>
                <p className="font-semibold mb-1">{t("wk.sumMuscles")}</p>
                <ul className="flex flex-wrap gap-1.5">{muscles.map(([m, n]) => <li key={m} className="chip" style={{ cursor: "default" }}>{t(`muscle.${m}`)} {n}</li>)}</ul>
              </div>
            )}
            <textarea className="field" placeholder={t("wk.sumNote")} aria-label={t("wk.sumNote")} value={workout.notes} onChange={e => onNotes(e.target.value)} />
            {unfinished > 0 && <p className="muted text-sm">{t("wk.unfinishedNote", { n: unfinished })}</p>}
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={onKeepGoing}>{t("wk.keepGoing")}</button>
              <button className="btn btn-primary flex-1" onClick={() => void onSave(workout.notes)}>{t("wk.save")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
