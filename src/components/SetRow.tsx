import { useState } from "react";
import { useApp } from "../app-context";
import { fmtWeight, fromDisplayWeight } from "../lib/format";
import type { WeightUnit } from "../db/types";
import type { ExerciseLog, SetLog, SetType } from "../workout/types";
import NumInput from "./NumInput";
import SetMenu from "./SetMenu";

interface Props {
  exLog: ExerciseLog;
  set: SetLog;
  index: number;
  unit: WeightUnit;
  step: number;
  prev: SetLog | undefined;
  /** Records this set broke (shows a trophy). */
  isPR?: boolean;
  onChange: (patch: Partial<SetLog>) => void;
  onToggleDone: () => void;
  onCopy: () => void;
  onAddBelow: () => void;
  onRemove: () => void;
}

type Field = "weight" | "reps" | null;

/** One compact line per set: menu | weight | reps | RIR | log. A stepper strip appears under the focused field. */
export default function SetRow({ exLog, set, index, unit, step, prev, isPR, onChange, onToggleDone, onCopy, onAddBelow, onRemove }: Props) {
  const { t } = useApp();
  const [field, setField] = useState<Field>(null);
  const [menu, setMenu] = useState(false);
  const tgt = exLog.target;
  const canDone = set.reps !== null && set.reps > 0 && !set.skipped;
  const typeShort = set.type === "normal" ? String(index + 1) : t(`wk.typeShort.${set.type}`);
  const label = t("wk.set", { n: index + 1 });
  const workingIdx = exLog.sets.slice(0, index + 1).filter(s => s.type !== "warmup").length;
  const weightDisp = set.weightKg === null ? null : Number(fmtWeight(set.weightKg, unit));

  const bump = (dir: 1 | -1) => {
    if (field === "weight") {
      const base = weightDisp ?? 0;
      onChange({ weightKg: fromDisplayWeight(Math.max(0, Math.round((base + dir * step) * 100) / 100), unit) });
    } else if (field === "reps") onChange({ reps: Math.max(0, (set.reps ?? (tgt && workingIdx ? tgt.repMax : 0)) + dir) });
  };

  const hint = prev
    ? prev.weightKg != null ? t("wk.last", { w: fmtWeight(prev.weightKg, unit), r: prev.reps ?? "–" }) : t("wk.lastBw", { r: prev.reps ?? "–" })
    : tgt && set.type !== "warmup" ? t("wk.target", { lo: tgt.repMin, hi: tgt.repMax, rir: tgt.rir }) : "";

  return (
    <li style={{ borderTop: "1px solid var(--border)", opacity: set.skipped ? 0.5 : 1 }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setField(null); }}>
      <div className="grid items-center gap-1 py-1.5" style={{ gridTemplateColumns: "40px minmax(0,1.3fr) minmax(0,1fr) 54px 48px", background: set.done ? "color-mix(in srgb, var(--accent) 14%, transparent)" : undefined, borderRadius: 8 }}>
        <button type="button" className="chip" style={{ minWidth: 40, padding: 0 }} aria-haspopup="dialog" aria-label={`${label}: ${t(`wk.type.${set.type}`)}. ${t("wk.menu.title")}`} onClick={() => setMenu(true)}>
          {typeShort}
        </button>
        <NumInput bare decimal label={`${label} ${t("wk.weight", { unit })}`} value={weightDisp} step={step} max={1000}
          onChange={v => onChange({ weightKg: v === null ? null : fromDisplayWeight(v, unit) })} dim={set.done} onFocus={() => setField("weight")} />
        <NumInput bare label={`${label} ${t("wk.reps")}`} value={set.reps} placeholder={tgt && workingIdx > 0 ? String(tgt.repMax) : undefined} max={200}
          onChange={v => onChange({ reps: v })} dim={set.done} onFocus={() => setField("reps")} />
        <select className="field" style={{ minHeight: 44, padding: "0 2px", textAlign: "center" }} aria-label={`${label} ${t("wk.rir")} (${t("wk.rirHint")})`} title={t("wk.rirHint")}
          value={set.rir ?? ""} onChange={e => onChange({ rir: e.target.value === "" ? null : Number(e.target.value) })}>
          <option value="">{t("wk.rir")}</option>
          {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 5 ? "5+" : n}</option>)}
        </select>
        <button type="button" className={set.done ? "btn btn-primary" : "btn"} style={{ minHeight: 44, padding: 0, fontSize: 20 }}
          aria-pressed={set.done} aria-disabled={!canDone && !set.done} title={!canDone && !set.done ? t("wk.needReps") : undefined}
          aria-label={set.done ? `${t("wk.undone")}: ${label}` : `${t("wk.done")}: ${label}`}
          onClick={() => { if (canDone || set.done) onToggleDone(); }}>
          {set.done ? "✓" : "○"}
        </button>
      </div>
      <div className="flex items-center gap-2 pb-1 text-xs muted" style={{ paddingLeft: 44 }}>
        <span className="flex-1 min-w-0 truncate">{set.skipped ? t("wk.skippedLabel") : hint}{set.type !== "normal" && ` · ${t(`wk.type.${set.type}`)}`}</span>
        {isPR && <span role="img" aria-label={t("pr.badge")} title={t("pr.badge")}>🏆</span>}
      </div>
      {field && (
        <div className="flex gap-2 pb-2" role="group" aria-label={t("wk.stepper", { field: field === "weight" ? t("wk.col.weight") : t("wk.col.reps") })}>
          <button type="button" className="btn flex-1" onMouseDown={e => e.preventDefault()} aria-label={`− ${label} ${field}`} onClick={() => bump(-1)}>− {field === "weight" ? step : 1}</button>
          <span className="muted text-sm self-center text-center" style={{ minWidth: 64 }}>{field === "weight" ? t("wk.col.weight") : t("wk.col.reps")}</span>
          <button type="button" className="btn flex-1" onMouseDown={e => e.preventDefault()} aria-label={`+ ${label} ${field}`} onClick={() => bump(1)}>＋ {field === "weight" ? step : 1}</button>
        </div>
      )}
      {menu && (
        <SetMenu set={set} index={index} onClose={() => setMenu(false)}
          onType={(ty: SetType) => onChange({ type: ty })} onAddBelow={onAddBelow} onCopy={onCopy}
          onSkip={() => onChange({ skipped: !set.skipped, done: false, doneAt: null })} onDelete={onRemove} />
      )}
    </li>
  );
}
