import { useApp } from "../app-context";
import { fmtWeight } from "../lib/format";
import { fromDisplayWeight } from "../lib/format";
import { SET_TYPES, type ExerciseLog, type SetLog, type SetType } from "../workout/types";
import type { WeightUnit } from "../db/types";
import NumInput from "./NumInput";

interface Props {
  exLog: ExerciseLog;
  set: SetLog;
  index: number;
  unit: WeightUnit;
  step: number;
  prev: SetLog | undefined;
  /** Whether weight applies (bodyweight moves may leave it blank). */
  onChange: (patch: Partial<SetLog>) => void;
  onToggleDone: () => void;
  onCopy: () => void;
  onRemove: () => void;
}

export default function SetRow({ exLog, set, index, unit, step, prev, onChange, onToggleDone, onCopy, onRemove }: Props) {
  const { t } = useApp();
  const tgt = exLog.target;
  const canDone = set.reps !== null && set.reps > 0;
  const typeShort = set.type === "normal" ? String(index + 1) : t(`wk.typeShort.${set.type}`);
  const workingIdx = exLog.sets.slice(0, index + 1).filter(s => s.type !== "warmup").length;
  const label = t("wk.set", { n: index + 1 });

  const cycleType = () => onChange({ type: SET_TYPES[(SET_TYPES.indexOf(set.type) + 1) % SET_TYPES.length] as SetType });

  return (
    <li className="grid gap-2 py-2" style={{ borderTop: "1px solid var(--border)", background: set.done ? "color-mix(in srgb, var(--accent) 12%, transparent)" : undefined, borderRadius: 8, paddingInline: 4 }}>
      <div className="flex items-center gap-2">
        <button type="button" className="chip" style={{ minWidth: 44 }} aria-label={`${label}: ${t(`wk.type.${set.type}`)}. ${t("wk.setType")}`} onClick={cycleType} aria-pressed={set.type !== "normal"}>{typeShort}</button>
        <span className="muted text-sm flex-1 min-w-0">
          {prev
            ? prev.weightKg != null ? t("wk.last", { w: fmtWeight(prev.weightKg, unit), r: prev.reps ?? "–" }) : t("wk.lastBw", { r: prev.reps ?? "–" })
            : tgt && set.type !== "warmup" ? t("wk.target", { lo: tgt.repMin, hi: tgt.repMax, rir: tgt.rir }) : ""}
          {set.type !== "normal" && ` · ${t(`wk.type.${set.type}`)}`}
        </span>
        <button type="button" className="btn" style={{ minWidth: 44, padding: 0, color: "var(--muted)" }} aria-label={`${t("wk.removeSet")}: ${label}`} onClick={onRemove}>✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumInput decimal label={`${label} ${t("wk.weight", { unit })}`} value={set.weightKg === null ? null : Number(fmtWeight(set.weightKg, unit))}
          step={step} max={1000} onChange={v => onChange({ weightKg: v === null ? null : fromDisplayWeight(v, unit) })} dim={set.done} />
        <NumInput label={`${label} ${t("wk.reps")}`} value={set.reps} placeholder={tgt && workingIdx > 0 ? String(tgt.repMax) : undefined} max={200}
          onChange={v => onChange({ reps: v })} dim={set.done} />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm">
          <span className="muted" title={t("wk.rirHint")}>{t("wk.rir")}</span>
          <select className="field" style={{ width: 72, minHeight: 44 }} aria-label={`${label} ${t("wk.rir")} (${t("wk.rirHint")})`} value={set.rir ?? ""}
            onChange={e => onChange({ rir: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">–</option>
            {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 5 ? "5+" : n}</option>)}
          </select>
        </label>
        <button type="button" className="btn text-sm" onClick={onCopy} aria-label={`${t("wk.copy")}: ${label}`}>⧉ {t("wk.copy")}</button>
        <button type="button" className={set.done ? "btn btn-primary" : "btn"} style={{ minWidth: 64, minHeight: 48, marginLeft: "auto", fontSize: 22 }}
          aria-pressed={set.done} aria-disabled={!canDone && !set.done}
          title={!canDone && !set.done ? t("wk.needReps") : undefined}
          aria-label={set.done ? `${t("wk.undone")}: ${label}` : `${t("wk.done")}: ${label}`}
          onClick={() => { if (canDone || set.done) onToggleDone(); }}>
          {set.done ? "✓" : "○"}
        </button>
      </div>
    </li>
  );
}
