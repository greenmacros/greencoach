/** Colour of one answer: green is where you want to be, then yellow, orange, red; grey is "nothing". */
export type Tone = "good" | "mild" | "warn" | "bad" | "none";

interface Props<T extends number> {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  /** One tone per option, in order. */
  tones: readonly Tone[];
  onChange: (v: T) => void;
}

/** One-tap rating scale (1-5 or 0-3): a numbered, coloured step per answer, with its word underneath. */
export default function ChipRow<T extends number>({ label, value, options, tones, onChange }: Props<T>) {
  return (
    <div className="grid gap-1" role="group" aria-label={label}>
      <span className="text-sm muted">{label}</span>
      <div className="scale">
        {options.map((o, i) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.label}
            style={{ "--tone": `var(--tone-${tones[i] ?? "none"})` } as React.CSSProperties} onClick={() => onChange(o.value)}>
            <span className="n" aria-hidden="true">{o.value}</span>
            <span className="l" aria-hidden="true">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
