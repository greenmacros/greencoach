import { useApp } from "../app-context";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  suffix?: string;
}

/** Big +/- buttons around a numeric input; made for one-handed use in a gym. */
export default function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, suffix }: Props) {
  const { t } = useApp();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("stepper.dec")}: ${label}`} onClick={() => onChange(clamp(value - step))}>−</button>
      <input className="field text-center" style={{ width: 64, padding: 0 }} inputMode="decimal" aria-label={label} value={value}
        onChange={e => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n)); }} />
      {suffix && <span className="muted text-sm">{suffix}</span>}
      <button type="button" className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("stepper.inc")}: ${label}`} onClick={() => onChange(clamp(value + step))}>＋</button>
    </div>
  );
}
