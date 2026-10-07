import { useState, type ReactNode } from "react";
import { useApp } from "../app-context";

export interface LegendItem { label: string; color: string; kind?: "line" | "dot" | "bar" | "band" }

interface Props {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table: { head: string[]; rows: (string | number)[][] };
  empty?: boolean;
  children: ReactNode;
}

/** Title, legend (only for 2+ series), the chart, and a table view of the same data. */
export default function ChartFrame({ title, subtitle, legend, table, empty, children }: Props) {
  const { t } = useApp();
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="card grid gap-2 m-0" aria-label={title}>
      <figcaption className="flex items-start gap-2">
        <span className="flex-1 min-w-0">
          <span className="font-bold block">{title}</span>
          {subtitle && <span className="muted text-sm block">{subtitle}</span>}
        </span>
        {!empty && <button className="chip" aria-pressed={asTable} onClick={() => setAsTable(v => !v)}>{asTable ? t("chart.chart") : t("chart.table")}</button>}
      </figcaption>
      {legend && legend.length > 1 && !asTable && (
        <ul className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--muted)" }}>
          {legend.map(l => (
            <li key={l.label} className="flex items-center gap-1.5">
              <svg width="16" height="10" aria-hidden="true">
                {l.kind === "dot" ? <circle cx="8" cy="5" r="4" fill={l.color} /> : l.kind === "bar" || l.kind === "band" ? <rect x="1" y="1" width="14" height="8" rx="2" fill={l.color} /> : <line x1="0" y1="5" x2="16" y2="5" stroke={l.color} strokeWidth="2" />}
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {empty ? <p className="muted text-sm">{t("chart.empty")}</p> : asTable ? (
        <div style={{ maxHeight: 280, overflow: "auto" }}>
          <table className="chart-table">
            <thead><tr>{table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row" style={{ fontWeight: 400 }}>{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </figure>
  );
}
