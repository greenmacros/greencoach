import { useState } from "react";

export interface HeatCell { key: string; value: number; label: string; outline?: boolean }

interface Props {
  rows: { key: string; label: string; cells: HeatCell[] }[];
  /** Shown under the grid, e.g. first and last column dates. */
  caption?: [string, string];
  /** Upper bounds of buckets 1..6 (bucket 0 is exactly 0). */
  thresholds: number[];
  label: string;
  legendLabels: [string, string];
  cell?: number;
}

/** Sequential single-hue heatmap (light -> dark = more). Each cell is focusable with a full-text label. */
export default function Heatmap({ rows, caption, thresholds, label, legendLabels, cell = 14 }: Props) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const b = (v: number) => {
    if (v <= 0) return 0;
    const i = thresholds.findIndex(x => v <= x);
    return i === -1 ? 6 : Math.min(6, i + 1);
  };
  return (
    <div style={{ position: "relative", overflowX: "auto" }} role="group" aria-label={label} onPointerLeave={() => setTip(null)}>
      <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <th scope="row" className="text-xs muted" style={{ fontWeight: 400, textAlign: "left", paddingRight: 6, whiteSpace: "nowrap" }}>{r.label}</th>
              {r.cells.map(c => (
                <td key={c.key} tabIndex={0} aria-label={c.label}
                  onPointerEnter={e => { const t = e.currentTarget.getBoundingClientRect(), p = e.currentTarget.closest("[role=group]")!.getBoundingClientRect(); setTip({ text: c.label, x: t.left - p.left, y: t.top - p.top }); }}
                  onFocus={e => { const t = e.currentTarget.getBoundingClientRect(), p = e.currentTarget.closest("[role=group]")!.getBoundingClientRect(); setTip({ text: c.label, x: t.left - p.left, y: t.top - p.top }); }}
                  onBlur={() => setTip(null)}
                  style={{ width: cell, height: cell, padding: 0, borderRadius: 3, background: `var(--seq-${b(c.value)})`, outline: c.outline ? "2px solid var(--text)" : undefined, outlineOffset: -1 }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <div className="flex justify-between text-xs muted" aria-hidden="true" style={{ maxWidth: "fit-content", gap: 24 }}><span>{caption[0]}</span><span>→ {caption[1]}</span></div>}
      <div className="flex items-center gap-1 text-xs muted mt-1" aria-hidden="true">
        <span>{legendLabels[0]}</span>
        {[0, 1, 2, 3, 4, 5, 6].map(i => <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: `var(--seq-${i})`, display: "inline-block" }} />)}
        <span>{legendLabels[1]}</span>
      </div>
      {tip && <div className="chart-tip" style={{ left: Math.max(0, tip.x - 40), top: Math.max(0, tip.y - 34) }}>{tip.text}</div>}
    </div>
  );
}
