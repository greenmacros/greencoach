import { useApp } from "../app-context";
import { formatRest } from "../lib/format";
import type { Exercise } from "../library/types";
import type { ExerciseSlot } from "../program/types";
import Stepper from "./Stepper";
import TextInput from "./TextInput";
import Icon from "./Icon";

interface Props {
  slot: ExerciseSlot;
  ex: Exercise | undefined;
  index: number;
  count: number;
  hasNext: boolean;
  onChange: (s: ExerciseSlot) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
}

export default function SlotEditor({ slot, ex, index, count, hasNext, onChange, onMove, onRemove, onReplace }: Props) {
  const { t, settings } = useApp();
  const set = (patch: Partial<ExerciseSlot>) => onChange({ ...slot, ...patch });
  const name = ex ? ex.name[settings.lang] : t("prog.missing");
  return (
    <li className="card grid gap-3" style={{ padding: 12 }}>
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold min-w-0">{slot.supersetGroup !== null && <><Icon name="swap" label={t("prog.superset")} /> </>}{name}
          {slot.optional && <span className="chip" style={{ cursor: "default", minHeight: 22, fontSize: 11, padding: "0 8px", marginLeft: 6, borderStyle: "dashed" }}>{t("wk.optional")}</span>}</p>
        <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("prog.up")}: ${name}`} disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" /></button>
        <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("prog.down")}: ${name}`} disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="down" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm"><span className="muted">{t("prog.sets")}</span><Stepper label={`${t("prog.sets")}: ${name}`} value={slot.sets} min={1} max={12} onChange={v => set({ sets: v })} /></label>
        <label className="grid gap-1 text-sm"><span className="muted">{t("prog.rir")}</span><Stepper label={`${t("prog.rir")}: ${name}`} value={slot.rir} min={0} max={6} onChange={v => set({ rir: v })} /></label>
        <label className="grid gap-1 text-sm"><span className="muted">{t("prog.repsMin")}</span><Stepper label={`${t("prog.repsMin")}: ${name}`} value={slot.repMin} min={1} max={slot.repMax} onChange={v => set({ repMin: v })} /></label>
        <label className="grid gap-1 text-sm"><span className="muted">{t("prog.repsMax")}</span><Stepper label={`${t("prog.repsMax")}: ${name}`} value={slot.repMax} min={slot.repMin} max={60} onChange={v => set({ repMax: v })} /></label>
      </div>
      <label className="grid gap-1 text-sm"><span className="muted">{t("prog.rest.label")} ({formatRest(slot.restSec)})</span>
        <Stepper label={`${t("prog.rest.label")}: ${name}`} value={slot.restSec} min={15} max={600} step={15} suffix="s" onChange={v => set({ restSec: v })} />
      </label>
      <TextInput className="field" placeholder={t("prog.notes")} aria-label={`${t("prog.notes")}: ${name}`} value={slot.notes} onValue={v => set({ notes: v })} />
      <div className="flex flex-wrap gap-2">
        {hasNext && <button className="chip" aria-pressed={slot.supersetGroup !== null} onClick={() => set({ supersetGroup: slot.supersetGroup === null ? 1 : null })}>{t("prog.superset")}</button>}
        <button className="chip" aria-pressed={!!slot.optional} onClick={() => set({ optional: !slot.optional })}>{t("wk.optional")}</button>
        <button className="chip" onClick={onReplace}>{t("prog.replace")}</button>
        <button className="chip" style={{ color: "var(--danger)" }} onClick={onRemove}>{t("prog.remove")}</button>
      </div>
    </li>
  );
}
