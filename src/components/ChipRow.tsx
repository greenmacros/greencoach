interface Props<T extends number> {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** One-tap rating row (1-5 or 0-3). */
export default function ChipRow<T extends number>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className="grid gap-1" role="group" aria-label={label}>
      <span className="text-sm muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.value} type="button" className="chip" style={{ minHeight: 44, flex: "1 1 40%", whiteSpace: "normal", textAlign: "center", lineHeight: 1.2, padding: "6px 10px" }} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
