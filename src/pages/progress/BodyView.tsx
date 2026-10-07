import { useState } from "react";
import { useApp } from "../../app-context";
import ChartFrame from "../../charts/ChartFrame";
import LineChart from "../../charts/LineChart";
import { compressImage } from "../../lib/image";
import { formatDayKey, fmtWeight, fromDisplayWeight } from "../../lib/format";
import { inRange, rangeStart, smoothWeights, weightPoints } from "../../progress/stats";
import { MEASURES, type Range } from "../../progress/types";
import type { BodyApi } from "../../progress/useBody";

export default function BodyView({ range, body, today }: { range: Range; body: BodyApi; today: string }) {
  const { t, settings } = useApp();
  const { lang, weightUnit: unit } = settings;
  const [dayKey, setDayKey] = useState(today);
  const [weight, setWeight] = useState("");
  const [more, setMore] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const start = rangeStart(range, today);

  const pts = weightPoints(body.metrics);
  const smooth = smoothWeights(pts);
  const shown = (arr: { dayKey: string; kg: number }[]) => arr.filter(p => inRange(p.dayKey, start, today)).map(p => ({ x: p.dayKey, y: Number(fmtWeight(p.kg, unit)) }));
  const fmtX = (k: string) => formatDayKey(k, lang, { month: "short", day: "numeric" });
  const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };

  const save = async () => {
    const entry: Record<string, unknown> = { dayKey };
    const wv = num(weight);
    if (wv) entry.weightKg = fromDisplayWeight(wv, unit);
    for (const m of MEASURES) { const v = num(vals[m] ?? ""); if (v) entry[m] = v; }
    if (Object.keys(entry).length === 1) return setMsg(t("body.needOne"));
    await body.saveMetric(entry as never);
    setWeight(""); setVals({}); setMsg(t("body.saved"));
  };

  return (
    <div className="grid gap-4">
      <form className="card grid gap-3" onSubmit={e => { e.preventDefault(); void save(); }} aria-label={t("body.log")}>
        <h2 className="font-bold">{t("body.log")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm"><span>{t("body.date")}</span><input className="field" type="date" value={dayKey} max={today} onChange={e => setDayKey(e.target.value || today)} /></label>
          <label className="grid gap-1 text-sm"><span>{t("body.weight", { u: unit })}</span><input className="field" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></label>
        </div>
        <button type="button" className="chip justify-self-start" aria-expanded={more} onClick={() => setMore(m => !m)}>{t("body.optional")}</button>
        {more && (
          <div className="grid grid-cols-2 gap-2">
            {MEASURES.map(m => <label key={m} className="grid gap-1 text-sm"><span>{t(`body.${m}`)}</span><input className="field" inputMode="decimal" value={vals[m] ?? ""} onChange={e => setVals({ ...vals, [m]: e.target.value })} /></label>)}
          </div>
        )}
        <button className="btn btn-primary" type="submit">{t("body.save")}</button>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </form>

      <ChartFrame title={t("body.trend")} empty={shown(pts).length === 0}
        legend={[{ label: t("body.raw"), color: "var(--series-1)", kind: "dot" }, { label: t("body.smooth"), color: "var(--series-2)" }]}
        table={{ head: [t("chart.date"), `${t("body.raw")} (${unit})`, `${t("body.smooth")} (${unit})`], rows: [...pts].reverse().filter(p => inRange(p.dayKey, start, today)).map(p => [fmtX(p.dayKey), fmtWeight(p.kg, unit), fmtWeight(Math.round((smooth.find(s => s.dayKey === p.dayKey)?.kg ?? p.kg) * 10) / 10, unit)]) }}>
        <LineChart label={t("body.trend")} fmtX={fmtX} fmtY={v => `${Math.round(v * 10) / 10}`}
          series={[
            { id: "raw", label: t("body.raw"), color: "var(--series-1)", kind: "dots", points: shown(pts) },
            { id: "ema", label: t("body.smooth"), color: "var(--series-2)", kind: "line", points: shown(smooth).map(p => ({ ...p, y: Math.round(p.y * 10) / 10 })) },
          ]} />
      </ChartFrame>

      <section className="card grid gap-2" aria-label={t("body.entries")}>
        <h2 className="font-bold">{t("body.entries")}</h2>
        {body.metrics.length === 0 ? <p className="muted text-sm">{t("body.none")}</p> : (
          <ul className="grid gap-1 text-sm">
            {body.metrics.slice(0, 30).map(m => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0">{formatDayKey(m.dayKey, lang, { month: "short", day: "numeric" })}</span>
                <span className="flex-1">{[m.weightKg !== undefined && `${fmtWeight(m.weightKg, unit)} ${unit}`, ...MEASURES.filter(x => m[x] !== undefined).map(x => `${t(`body.${x}`).replace(/\s*\(cm\)|（cm）/, "")} ${m[x]}`)].filter(Boolean).join(" · ")}</span>
                <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("body.delete")}: ${m.dayKey}`} onClick={() => void body.removeMetric(m.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card grid gap-2" aria-label={t("body.photos")}>
        <h2 className="font-bold">{t("body.photos")}</h2>
        <p className="muted text-sm">{t("body.photosHint")}</p>
        <label className="btn justify-self-start" style={{ display: "inline-flex", alignItems: "center" }}>
          ＋ {t("body.addPhoto")}
          <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) await body.addPhoto(today, await compressImage(f, 720, 0.75)); e.target.value = ""; }} />
        </label>
        <ul className="grid grid-cols-3 gap-2">
          {body.photos.map(p => (
            <li key={p.id} className="grid gap-1">
              <img src={p.dataUrl} alt={t("body.photoAlt", { date: formatDayKey(p.dayKey, lang, { month: "short", day: "numeric" }) })} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10 }} />
              <button className="btn text-xs" onClick={() => void body.removePhoto(p.id)}>{t("body.deletePhoto")}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
