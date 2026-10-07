import { useEffect, useState } from "react";

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  /** Weight fields allow decimals; reps do not. */
  decimal?: boolean;
  dim?: boolean;
}

/** − [number] + with a numeric keypad; blank means "not entered yet". Buttons are 44px for one-handed use. */
export default function NumInput({ value, onChange, label, step = 1, min = 0, max = 999, placeholder, decimal, dim }: Props) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => { setText(prev => (parseFloat(prev) === value || (value === null && prev === "") ? prev : value === null ? "" : String(value))); }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const bump = (dir: 1 | -1) => {
    const base = value ?? (placeholder && !Number.isNaN(parseFloat(placeholder)) ? parseFloat(placeholder) : 0);
    const n = value === null && dir === 1 ? base : clamp(base + dir * step);
    setText(String(n));
    onChange(n);
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`− ${label}`} onClick={() => bump(-1)}>−</button>
      <input className="field text-center" style={{ minWidth: 0, flex: 1, padding: 0, fontWeight: 700, fontSize: 18, opacity: dim ? 0.6 : 1 }}
        inputMode={decimal ? "decimal" : "numeric"} aria-label={label} placeholder={placeholder} value={text}
        onFocus={e => e.currentTarget.select()}
        onChange={e => {
          const raw = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          if (raw === "" || raw === ".") onChange(null);
          else onChange(clamp(parseFloat(raw)));
        }} />
      <button type="button" className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`+ ${label}`} onClick={() => bump(1)}>＋</button>
    </div>
  );
}
