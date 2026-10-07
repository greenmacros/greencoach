import { useApp } from "../app-context";
import type { Band } from "../coach/types";
import type { Muscle } from "../library/types";

interface Props { rows: { muscle: Muscle; sets: number; band: Band }[] }

/** Hard sets per muscle as horizontal bars over the productive range (MEV-MRV band). */
export default function MuscleBars({ rows }: Props) {
  const { t } = useApp();
  const max = Math.max(1, ...rows.map(r => Math.max(r.sets, r.band.mrv)));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <ul className="grid gap-2">
      {rows.map(r => {
        const status = r.sets < r.band.mev ? "below" : r.sets > r.band.mrv ? "above" : "in";
        const text = `${t(`muscle.${r.muscle}`)}: ${r.sets} · ${t(`chart.range.${status}`)} (${r.band.mev}-${r.band.mrv})`;
        return (
          <li key={r.muscle} className="grid items-center gap-2" style={{ gridTemplateColumns: "6.5rem 1fr 2.5rem" }} title={text} aria-label={text}>
            <span className="text-sm truncate">{t(`muscle.${r.muscle}`)}</span>
            <span aria-hidden="true" style={{ position: "relative", height: 14, background: "transparent" }}>
              <span style={{ position: "absolute", left: pct(r.band.mev), width: pct(r.band.mrv - r.band.mev), top: 0, bottom: 0, background: "var(--band)", borderRadius: 4 }} />
              <span style={{ position: "absolute", left: 0, width: pct(r.sets), top: 3, bottom: 3, background: "var(--series-1)", borderRadius: "0 4px 4px 0" }} />
            </span>
            <span className="text-sm text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.sets}</span>
          </li>
        );
      })}
    </ul>
  );
}
