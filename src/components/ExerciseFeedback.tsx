import { useApp } from "../app-context";
import type { ExerciseLog } from "../workout/types";
import ChipRow from "./ChipRow";

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** Shown under an exercise once every set is done. Each question is a single tap and optional. */
export default function ExerciseFeedback({ log, name, onChange }: { log: ExerciseLog; name: string; onChange: (patch: Partial<ExerciseLog>) => void }) {
  const { t } = useApp();
  return (
    <div className="card grid gap-3" style={{ padding: 12, borderColor: "var(--accent)" }} role="group" aria-label={t("fb.exTitle", { name })}>
      <div>
        <p className="font-semibold">{t("fb.exTitle", { name })}</p>
        <p className="muted text-xs">{t("fb.optional")}</p>
      </div>
      <ChipRow<1 | 2 | 3 | 4 | 5> label={t("fb.difficulty")} value={log.difficulty} onChange={v => onChange({ difficulty: v })}
        options={range(1, 5).map(n => ({ value: n as 1 | 2 | 3 | 4 | 5, label: t(`fb.diff.${n}`) }))} />
      <ChipRow<0 | 1 | 2 | 3> label={t("fb.pump")} value={log.pump} onChange={v => onChange({ pump: v })}
        options={range(0, 3).map(n => ({ value: n as 0 | 1 | 2 | 3, label: t(`fb.pump.${n}`) }))} />
      <ChipRow<0 | 1 | 2 | 3> label={t("fb.joint")} value={log.jointPain} onChange={v => onChange({ jointPain: v })}
        options={range(0, 3).map(n => ({ value: n as 0 | 1 | 2 | 3, label: t(`fb.joint.${n}`) }))} />
    </div>
  );
}
