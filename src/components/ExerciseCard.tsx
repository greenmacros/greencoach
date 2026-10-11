import { useState } from "react";
import { useApp } from "../app-context";
import { formatRest, weightStep } from "../lib/format";
import type { Exercise } from "../library/types";
import { addSetAfter, copyLastSet, skipExercise, unskipExercise } from "../workout/model";
import type { ExerciseLog, SetLog } from "../workout/types";
import type { WeightUnit } from "../db/types";
import ExerciseMedia from "./ExerciseMedia";
import ExercisePreview from "./ExercisePreview";
import { weightHintKey, weightKind } from "../workout/weightHint";
import SkipSheet from "./SkipSheet";
import type { AutoChange } from "../coach/auto";
import { changeParts, isMajor } from "../coach/changeText";
import { bandsOf } from "../bands/bands";
import { explain } from "../coach/explain";
import SetRow from "./SetRow";
import Stepper from "./Stepper";
import TextInput from "./TextInput";
import Icon from "./Icon";

interface Props {
  log: ExerciseLog;
  ex: Exercise | undefined;
  unit: WeightUnit;
  prev: SetLog[];
  prSets: Map<string, unknown>;
  index: number;
  count: number;
  onChange: (fn: (e: ExerciseLog) => ExerciseLog) => void;
  onSetToggle: (setId: string) => void;
  onAddSet: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSwap: () => void;
  onFeedback: () => void;
  /** What the coach changed for this exercise this week. */
  coach?: AutoChange;
}

export default function ExerciseCard({ log, ex, unit, prev, prSets, index, count, onChange, onSetToggle, onAddSet, onMove, onRemove, onSwap, onFeedback, coach }: Props) {
  const { t, settings } = useApp();
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [coachWhy, setCoachWhy] = useState(false);
  const coachBits = coach && isMajor(coach) ? changeParts(coach, unit, t, true, bandsOf(settings)) : [];
  const name = ex ? ex.name[settings.lang] : t("prog.missing");
  const step = weightStep(ex?.equipment ?? [], unit);
  const doneCount = log.sets.filter(s => s.done).length;
  const kind = weightKind(ex);
  const hintKey = weightHintKey(ex);
  const allDone = log.sets.length > 0 && log.sets.every(s => s.done || s.skipped) && doneCount > 0;
  const hasFeedback = log.difficulty !== undefined || log.pump !== undefined || log.jointPain !== undefined || log.volume !== undefined;

  return (
    <article className="card grid gap-2" aria-label={name} style={log.skip ? { opacity: 0.7 } : undefined}>
      <div className="flex items-start gap-3">
        {ex && (
          <button type="button" aria-label={`${t("wk.enlarge")}: ${name}`} onClick={() => setZoom(true)}
            style={{ padding: 0, border: 0, background: "none", cursor: "zoom-in", borderRadius: 10 }}>
            <ExerciseMedia ex={ex} size={64} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {ex && <span className="chip" style={{ cursor: "default", minHeight: 24, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", padding: "0 8px" }}>{t(`muscle.${ex.primary[0]}`)}</span>}
          {log.optional && <span className="chip" style={{ cursor: "default", minHeight: 24, fontSize: 11, fontWeight: 700, padding: "0 8px", marginLeft: 6, borderStyle: "dashed" }}>{t("wk.optional")}</span>}
          <h2 className="font-bold leading-tight mt-1">{log.supersetGroup !== null && <><Icon name="swap" label={t("prog.superset")} /> </>}{name}</h2>
          <p className="muted text-xs uppercase">
            {kind === "addWeight" ? t("wk.bwLoadable") : kind === "assist" ? t("wk.assisted") : kind === "band" ? t("wk.bandLogged") : ex?.equipment.map(e => t(`equip.${e}`)).join(" · ")} · {t("wk.rest", { t: formatRest(log.restSec) })}
          </p>
          {coach && coachBits.length > 0 && (
            <button type="button" className="text-xs font-semibold text-left mt-0.5" aria-expanded={coachWhy} aria-label={`${t("auto.mark")}: ${coachBits.map(b => b.text).join(", ")}`}
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--text)" }} onClick={() => setCoachWhy(w => !w)}>
              {coachBits.map((b, i) => (
                <span key={i} className="whitespace-nowrap" style={{ color: b.dir === "up" ? "var(--accent)" : "var(--danger)" }}>{i > 0 && <span className="muted"> · </span>}<Icon name={b.dir === "up" ? "triUp" : "triDown"} size="0.8em" /> {b.text}</span>
              ))}
              {coachWhy && <span className="block muted font-normal">{explain(coach.reason, t)}</span>}
            </button>
          )}
        </div>
        <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-expanded={more} aria-label={`${t("prog.edit")}: ${name}`} onClick={() => setMore(m => !m)}><Icon name="more" /></button>
      </div>

      {more && (
        <div className="grid gap-2 card" style={{ padding: 10 }}>
          <label className="grid gap-1 text-sm"><span className="muted">{t("wk.restSetting")}</span>
            <Stepper label={t("wk.restSetting")} value={log.restSec} min={15} max={600} step={15} suffix="s" onChange={v => onChange(e => ({ ...e, restSec: v }))} />
          </label>
          <TextInput className="field" placeholder={t("wk.notes")} aria-label={`${t("wk.notes")}: ${name}`} value={log.notes} onValue={v => onChange(x => ({ ...x, notes: v }))} />
          <div className="flex flex-wrap gap-2">
            <button className="chip" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" /> {t("wk.up")}</button>
            <button className="chip" disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="down" /> {t("wk.down")}</button>
            <button className="chip" onClick={onSwap}><Icon name="swap" /> {t("wk.swapExercise")}</button>
            <button className="chip" onClick={onFeedback}>{t("fb.open")}</button>
            {!log.skip && <button className="chip" onClick={() => { setMore(false); setSkipping(true); }}><Icon name="skip" /> {t("wk.skipExercise")}</button>}
            <button className="chip" style={{ color: "var(--danger)" }} onClick={onRemove}>{t("wk.removeExercise")}</button>
          </div>
        </div>
      )}

      {log.notes && !more && <p className="muted text-sm"><Icon name="note" /> {log.notes}</p>}

      {log.skip ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip" style={{ cursor: "default" }}><Icon name="skip" /> {t("wk.skippedExercise", { reason: t(`skip.r.${log.skip.reason}`) })}</span>
          <button className="btn" onClick={() => onChange(e => unskipExercise(e))}>{t("wk.undoSkip")}</button>
        </div>
      ) : <>
      {hintKey && <p className="muted text-xs" style={{ marginBottom: -4 }}><Icon name="info" size="1em" /> {t(hintKey, { bar: unit === "kg" ? "20 kg" : "45 lb" /* standard Olympic bar in each system */ })}</p>}
      <div className="grid text-xs font-bold uppercase muted" aria-hidden="true" style={{ gridTemplateColumns: "40px minmax(0,1.3fr) minmax(0,1fr) 54px 48px", gap: 4, textAlign: "center" }}>
        <span /><span>{kind === "band" ? t("wk.col.band") : `${t(`wk.col.${kind}`)} (${unit})`}</span><span>{t("wk.col.reps")}</span><span>{t("wk.rir")}</span><span>{t("wk.col.log")}</span>
      </div>
      <ol className="grid">
        {log.sets.map((s, i) => (
          <SetRow key={s.id} exLog={log} set={s} index={i} unit={unit} step={step} bandMode={kind === "band"} prev={prev[Math.min(i, prev.length - 1)]} isPR={prSets.has(s.id)}
            onChange={patch => onChange(e => ({
              ...e,
              // A band picked for one set also fills the later, unfinished sets that have none yet.
              sets: e.sets.map((x, j) => (x.id === s.id ? { ...x, ...patch } : patch.bands && j > i && !x.done && !x.bands?.length ? { ...x, bands: [...patch.bands] } : x)),
            }))}
            onToggleDone={() => onSetToggle(s.id)}
            onCopy={() => onChange(e => copyLastSet(e, s.id, prev))}
            onAddBelow={() => onChange(e => addSetAfter(e, s.id))}
            onRemove={() => onChange(e => ({ ...e, sets: e.sets.filter(x => x.id !== s.id) }))} />
        ))}
      </ol>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={onAddSet}><Icon name="plus" /> {t("wk.addSet")}</button>
        {(allDone || hasFeedback) && <button className={hasFeedback ? "btn" : "btn btn-primary"} onClick={onFeedback}>{hasFeedback && <><Icon name="check" label={t("fb.given")} /> </>}{t("fb.open")}</button>}
      </div>
      </>}
      {zoom && ex && <ExercisePreview ex={ex} onClose={() => setZoom(false)} />}
      {skipping && <SkipSheet title={t("skip.exTitle", { name })} onCancel={() => setSkipping(false)} onSkip={r => { setSkipping(false); onChange(e => skipExercise(e, r)); }} />}
    </article>
  );
}
