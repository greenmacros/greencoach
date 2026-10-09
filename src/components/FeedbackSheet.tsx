import { useState } from "react";
import { useApp } from "../app-context";
import type { SorenessLevel, SorenessQuestion } from "../feedback/soreness";
import type { Muscle } from "../library/types";
import type { ExerciseLog } from "../workout/types";
import ChipRow from "./ChipRow";
import Icon from "./Icon";

interface Props {
  log: ExerciseLog;
  name: string;
  muscle: Muscle;
  /** Present when we should ask how sore this muscle got last time (and have not asked yet). */
  soreness?: SorenessQuestion;
  onSave: (patch: Partial<ExerciseLog>, soreness?: SorenessLevel) => void;
  onCancel: () => void;
}

/** RP-style feedback modal: joint pain, soreness from last time, pump, volume, difficulty. All optional. */
export default function FeedbackSheet({ log, name, muscle, soreness, onSave, onCancel }: Props) {
  const { t } = useApp();
  const [d, setD] = useState({ difficulty: log.difficulty, jointPain: log.jointPain, pump: log.pump, volume: log.volume });
  const [sore, setSore] = useState<SorenessLevel | undefined>();
  const m = t(`muscle.${muscle}`).toLowerCase();
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  return (
    <div className="sheet" onClick={onCancel}>
      <div className="sheet-body grid gap-4" role="dialog" aria-modal="true" aria-label={t("fb.title")} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1"><h2 className="text-2xl font-bold">{t("fb.title")}</h2><p className="muted text-sm">{name} · {t("fb.optional")}</p></div>
          <button className="btn" aria-label={t("lib.close")} onClick={onCancel}><Icon name="close" /></button>
        </div>

        <ChipRow<0 | 1 | 2 | 3> label={t("fb.jointQ", { name })} value={d.jointPain} onChange={v => setD({ ...d, jointPain: v })}
          options={range(0, 3).map(n => ({ value: n as 0 | 1 | 2 | 3, label: t(`fb.joint.${n}`) }))} />

        {soreness && (
          <ChipRow<SorenessLevel> label={t("fb.soreQ", { muscle: m })} value={sore} onChange={setSore}
            options={([0, 1, 2, 3] as SorenessLevel[]).map(n => ({ value: n, label: t(`fb.sore.${n}`) }))} />
        )}

        <ChipRow<0 | 1 | 2 | 3> label={t("fb.pumpQ", { muscle: m })} value={d.pump} onChange={v => setD({ ...d, pump: v })}
          options={range(0, 3).map(n => ({ value: n as 0 | 1 | 2 | 3, label: t(`fb.pump.${n}`) }))} />

        <ChipRow<1 | 2 | 3 | 4> label={t("fb.volumeQ", { muscle: m })} value={d.volume} onChange={v => setD({ ...d, volume: v })}
          options={range(1, 4).map(n => ({ value: n as 1 | 2 | 3 | 4, label: t(`fb.vol.${n}`) }))} />

        <ChipRow<1 | 2 | 3 | 4 | 5> label={t("fb.difficulty")} value={d.difficulty} onChange={v => setD({ ...d, difficulty: v })}
          options={range(1, 5).map(n => ({ value: n as 1 | 2 | 3 | 4 | 5, label: t(`fb.diff.${n}`) }))} />

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>{t("data.cancel")}</button>
          <button className="btn btn-primary" onClick={() => onSave(d, sore)}>{t("fb.save")}</button>
        </div>
      </div>
    </div>
  );
}
