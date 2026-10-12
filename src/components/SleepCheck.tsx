import { useApp } from "../app-context";

export type Sleep = 1 | 2 | 3;

/** "How did you sleep last night?" as one tap; optional, feeds the coach's recovery decisions. */
export default function SleepCheck({ value, onChange }: { value: Sleep | undefined; onChange: (v: Sleep) => void }) {
  const { t } = useApp();
  return (
    <div className="grid gap-2" role="group" aria-label={t("sleep.q")}>
      <p className="font-semibold text-sm">{t("sleep.q")} <span className="muted font-normal">{t("sleep.optional")}</span></p>
      <div className="seg">
        {([1, 2, 3] as const).map(v => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t(`sleep.${v}`)}</button>
        ))}
      </div>
    </div>
  );
}
