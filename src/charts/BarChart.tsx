import { useState } from "react";
import { niceTicks, useWidth } from "./useWidth";

export interface Bar { key: string; label: string; value: number; tip?: string }

interface Props {
  bars: Bar[];
  color?: string;
  height?: number;
  fmtY: (v: number) => string;
  label: string;
}

const PAD = { l: 40, r: 8, t: 10, b: 24 };

/** Vertical bars with 4px rounded data-ends anchored to the baseline, 2px gaps, per-bar hover tooltip. */
export default function BarChart({ bars, color = "var(--series-1)", height = 180, fmtY, label }: Props) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map(b => b.value));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const slot = iw / Math.max(1, bars.length);
  const bw = Math.max(2, Math.min(36, slot - 2));
  const sy = (v: number) => PAD.t + ih - (v / top) * ih;
  const every = Math.ceil(bars.length / Math.max(1, Math.floor(iw / 56)));
  const r = Math.min(4, bw / 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart-svg" width={w} height={height} role="img" aria-label={label} tabIndex={0}
        onKeyDown={e => {
          if (e.key === "ArrowRight") setHover(h => Math.min(bars.length - 1, (h ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover(h => Math.max(0, (h ?? bars.length) - 1));
        }} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={w - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--chart-grid)" />
            <text x={PAD.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--muted)">{fmtY(v)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = PAD.l + i * slot + (slot - bw) / 2;
          const y = sy(b.value), h = PAD.t + ih - y;
          const rr = Math.min(r, h);
          return (
            <g key={b.key} onPointerEnter={() => setHover(i)}>
              <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={ih} fill="transparent" />
              {b.value > 0 && <path d={`M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bw - rr} Q${x + bw},${y} ${x + bw},${y + rr} V${y + h} Z`} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {i % every === 0 && <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{b.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && bars[hover] && (
        <div className="chart-tip" role="status" style={{ left: Math.min(Math.max(0, PAD.l + hover * slot - 40), w - 140), top: 0 }}>
          <div className="font-semibold">{bars[hover].label}</div>
          <div>{bars[hover].tip ?? fmtY(bars[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
