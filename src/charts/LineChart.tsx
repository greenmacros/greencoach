import { useMemo, useState } from "react";
import { keyToDate } from "../program/schedule";
import { niceTicks, useWidth } from "./useWidth";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: { x: string; y: number }[];
  /** "line": 2px line; "dots": 8px markers only; "both". */
  kind?: "line" | "dots" | "both";
}

interface Props {
  series: LineSeries[];
  height?: number;
  fmtY: (v: number) => string;
  fmtX: (dayKey: string) => string;
  label: string;
}

const PAD = { l: 40, r: 12, t: 10, b: 24 };
const ms = (k: string) => keyToDate(k).getTime();

/** Time-series line chart with a crosshair + tooltip (pointer, touch and arrow keys). */
export default function LineChart({ series, height = 200, fmtY, fmtX, label }: Props) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const xs = useMemo(() => [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort(), [series]);
  const ys = series.flatMap(s => s.points.map(p => p.y));
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.08 || Math.max(1, hi * 0.05);
  const ticks = niceTicks(Math.max(0, lo - pad), hi + pad);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x0 = ms(xs[0] ?? "2000-01-01"), x1 = ms(xs[xs.length - 1] ?? "2000-01-02");
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const sx = (k: string) => PAD.l + (x1 === x0 ? iw / 2 : ((ms(k) - x0) / (x1 - x0)) * iw);
  const sy = (v: number) => PAD.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  const xTicks = xs.length <= 1 ? xs : [xs[0], xs[Math.floor((xs.length - 1) / 2)], xs[xs.length - 1]].filter((v, i, a) => a.indexOf(v) === i);

  const nearest = (px: number) => {
    let best = 0, d = Infinity;
    xs.forEach((k, i) => { const dd = Math.abs(sx(k) - px); if (dd < d) { d = dd; best = i; } });
    return best;
  };
  const hx = hover !== null ? xs[hover] : null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart-svg" width={w} height={height} role="img" aria-label={label} tabIndex={0}
        onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHover(nearest(e.clientX - r.left)); }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={e => {
          if (e.key === "ArrowRight") setHover(h => Math.min(xs.length - 1, (h ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover(h => Math.max(0, (h ?? xs.length) - 1));
          else if (e.key === "Escape") setHover(null);
        }} onBlur={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={w - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--muted)">{fmtY(v)}</text>
          </g>
        ))}
        {xTicks.map(k => <text key={k} x={sx(k)} y={height - 6} textAnchor={k === xs[0] && xs.length > 1 ? "start" : k === xs[xs.length - 1] && xs.length > 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{fmtX(k)}</text>)}
        {series.map(s => {
          const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x));
          const kind = s.kind ?? "both";
          return (
            <g key={s.id}>
              {kind !== "dots" && pts.length > 1 && <polyline points={pts.map(p => `${sx(p.x)},${sy(p.y)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              {kind !== "line" && pts.map(p => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          );
        })}
        {hx && (
          <g aria-hidden="true">
            <line x1={sx(hx)} x2={sx(hx)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
            {series.map(s => { const p = s.points.find(q => q.x === hx); return p ? <circle key={s.id} cx={sx(hx)} cy={sy(p.y)} r="5" fill={s.color} stroke="var(--surface)" strokeWidth="2" /> : null; })}
          </g>
        )}
      </svg>
      {hx && (
        <div className="chart-tip" role="status" style={{ left: Math.min(Math.max(0, sx(hx) - 60), w - 140), top: 0 }}>
          <div className="font-semibold">{fmtX(hx)}</div>
          {series.map(s => { const p = s.points.find(q => q.x === hx); return p ? <div key={s.id}><span style={{ color: s.color }} aria-hidden="true">● </span>{s.label}: {fmtY(p.y)}</div> : null; })}
        </div>
      )}
    </div>
  );
}
