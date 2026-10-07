import { useState } from "react";
import { useApp } from "../app-context";
import { formatRest, weightStep } from "../lib/format";
import type { Exercise } from "../library/types";
import { copyLastSet } from "../workout/model";
import type { ExerciseLog, SetLog } from "../workout/types";
import type { WeightUnit } from "../db/types";
import ExerciseMedia from "./ExerciseMedia";
import SetRow from "./SetRow";
import Stepper from "./Stepper";

interface Props {
  log: ExerciseLog;
  ex: Exercise | undefined;
  unit: WeightUnit;
  prev: SetLog[];
  index: number;
  count: number;
  onChange: (fn: (e: ExerciseLog) => ExerciseLog) => void;
  onSetToggle: (setId: string) => void;
  onAddSet: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSwap: () => void;
}

export default function ExerciseCard({ log, ex, unit, prev, index, count, onChange, onSetToggle, onAddSet, onMove, onRemove, onSwap }: Props) {
  const { t, settings } = useApp();
  const [more, setMore] = useState(false);
  const name = ex ? ex.name[settings.lang] : t("prog.missing");
  const step = weightStep(ex?.equipment ?? [], unit);
  const doneCount = log.sets.filter(s => s.done).length;

  return (
    <article className="card grid gap-2" aria-label={name}>
      <div className="flex items-start gap-3">
        {ex && <ExerciseMedia ex={ex} size={56} />}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold leading-tight">{log.supersetGroup !== null && "⇄ "}{name}</h2>
          <p className="muted text-sm">{t("wk.workingSets", { n: doneCount })} / {log.sets.length} · {t("wk.rest", { t: formatRest(log.restSec) })}</p>
        </div>
        <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-expanded={more} aria-label={`${t("prog.edit")}: ${name}`} onClick={() => setMore(m => !m)}>⋯</button>
      </div>

      {more && (
        <div className="grid gap-2 card" style={{ padding: 10 }}>
          <label className="grid gap-1 text-sm"><span className="muted">{t("wk.restSetting")}</span>
            <Stepper label={t("wk.restSetting")} value={log.restSec} min={15} max={600} step={15} suffix="s" onChange={v => onChange(e => ({ ...e, restSec: v }))} />
          </label>
          <input className="field" placeholder={t("wk.notes")} aria-label={`${t("wk.notes")}: ${name}`} value={log.notes} onChange={e => onChange(x => ({ ...x, notes: e.target.value }))} />
          <div className="flex flex-wrap gap-2">
            <button className="chip" disabled={index === 0} onClick={() => onMove(-1)}>↑ {t("wk.up")}</button>
            <button className="chip" disabled={index === count - 1} onClick={() => onMove(1)}>↓ {t("wk.down")}</button>
            <button className="chip" onClick={onSwap}>⇄ {t("wk.swapExercise")}</button>
            <button className="chip" style={{ color: "var(--danger)" }} onClick={onRemove}>{t("wk.removeExercise")}</button>
          </div>
        </div>
      )}

      {log.notes && !more && <p className="muted text-sm">📝 {log.notes}</p>}

      <ol className="grid gap-1">
        {log.sets.map((s, i) => (
          <SetRow key={s.id} exLog={log} set={s} index={i} unit={unit} step={step} prev={prev[Math.min(i, prev.length - 1)]}
            onChange={patch => onChange(e => ({ ...e, sets: e.sets.map(x => (x.id === s.id ? { ...x, ...patch } : x)) }))}
            onToggleDone={() => onSetToggle(s.id)}
            onCopy={() => onChange(e => copyLastSet(e, s.id, prev))}
            onRemove={() => onChange(e => ({ ...e, sets: e.sets.filter(x => x.id !== s.id) }))} />
        ))}
      </ol>
      <button className="btn" onClick={onAddSet}>＋ {t("wk.addSet")}</button>
    </article>
  );
}
