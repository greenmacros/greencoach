import { useMemo } from "react";
import { useApp } from "../../app-context";
import BarChart from "../../charts/BarChart";
import ChartFrame from "../../charts/ChartFrame";
import Heatmap from "../../charts/Heatmap";
import MuscleBars from "../../charts/MuscleBars";
import { formatDayKey, fmtWeight } from "../../lib/format";
import type { LibraryApi } from "../../library/useLibrary";
import { MUSCLES, type Muscle } from "../../library/types";
import { addDays, weekDays, weekStart } from "../../program/schedule";
import type { ProgramApi } from "../../program/useProgram";
import { plannedSessionCount } from "../../coach/stats";
import { dailySets, landmarksFor, prTimeline, rangeStart, sessionDurations, weekStreak, weeklyMuscleSets, weeklyTotals } from "../../progress/stats";
import type { Range } from "../../progress/types";
import type { WorkoutLog } from "../../workout/types";
import { prText } from "../../workout/prText";
import { summarize } from "../../workout/model";
import GoalsView from "./GoalsView";
import type { BodyApi } from "../../progress/useBody";

interface Props { range: Range; workouts: WorkoutLog[]; lib: LibraryApi; prog: ProgramApi; body: BodyApi }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <p className="muted text-xs">{label}</p>
      <p className="font-bold" style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

export default function Overview({ range, workouts, lib, prog, body }: Props) {
  const { t, settings, profile } = useApp();
  const lang = settings.lang, unit = settings.weightUnit;
  const today = prog.todayKey;
  const start = rangeStart(range, today);
  const short = (k: string) => formatDayKey(k, lang, { month: "numeric", day: "numeric" });
  const nf = new Intl.NumberFormat(lang === "ja" ? "ja-JP" : undefined, { maximumFractionDigits: 0 });

  const inRange = useMemo(() => workouts.filter(w => w.finishedAt && (start === null || w.dayKey >= start) && w.dayKey <= today), [workouts, start, today]);
  const weeks = useMemo(() => weeklyTotals(workouts, start, today, lib.byId), [workouts, start, today, lib.byId]);
  const muscleWeeks = useMemo(() => weeklyMuscleSets(workouts, start, today, lib.byId), [workouts, start, today, lib.byId]);
  const prs = useMemo(() => prTimeline(workouts, start, today), [workouts, start, today]);
  const durations = useMemo(() => sessionDurations(workouts, start, today), [workouts, start, today]);
  const daily = useMemo(() => dailySets(workouts), [workouts]);
  const band = landmarksFor(profile.experience, profile.goal, profile.phase);

  const volume = inRange.reduce((n, w) => n + summarize(w, lib.byId).volumeKg, 0);
  const sets = inRange.reduce((n, w) => n + summarize(w, lib.byId).workingSets, 0);
  const planned = prog.active ? plannedSessionCount(prog.active) : 0;
  const adherence = planned > 0 && weeks.length ? Math.min(100, Math.round((inRange.length / (planned * weeks.length)) * 100)) : null;

  // Week range: one bar per day; otherwise one bar per week.
  const volBars = range === "week"
    ? weekDays(today).map(k => ({ key: k, label: formatDayKey(k, lang, { weekday: "short" }), value: inRange.filter(w => w.dayKey === k).reduce((n, w) => n + summarize(w, lib.byId).volumeKg, 0) }))
    : weeks.map(w => ({ key: w.weekStart, label: short(w.weekStart), value: w.volumeKg }));
  const volBarsDisp = volBars.map(b => ({ ...b, value: Number(fmtWeight(b.value, unit)), tip: `${nf.format(Number(fmtWeight(b.value, unit)))} ${unit}` }));

  // The most recent week that has any training (the current week is often still empty).
  const latest = [...muscleWeeks].reverse().find(w => Object.values(w.sets).some(v => (v ?? 0) > 0)) ?? muscleWeeks[muscleWeeks.length - 1];
  const trained = MUSCLES.filter(m => muscleWeeks.some(w => (w.sets[m] ?? 0) > 0));
  const muscleRows = trained.map(m => ({ muscle: m as Muscle, sets: Math.round((latest?.sets[m] ?? 0) * 10) / 10, band: band(m) }));
  const heatWeeks = muscleWeeks.slice(-26);

  const calWeeks = Math.min(53, Math.max(5, range === "week" ? 5 : range === "month" ? 6 : range === "3months" ? 14 : 53));
  const calStart = addDays(weekStart(today), -7 * (calWeeks - 1));
  const calCols = Array.from({ length: calWeeks }, (_, i) => addDays(calStart, i * 7));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={t("stat.sessions")} value={String(inRange.length)} />
        <Stat label={t("stat.volume")} value={`${nf.format(Number(fmtWeight(volume, unit)))} ${unit}`} />
        <Stat label={t("stat.sets")} value={String(sets)} />
        <Stat label={t("stat.prs")} value={String(prs.length)} />
        <Stat label={t("stat.streak")} value={String(weekStreak(workouts, today))} />
        {adherence !== null && <Stat label={t("stat.adherence")} value={`${adherence}%`} />}
      </div>

      <ChartFrame title={t("pc.volume")} subtitle={t("pc.volumeSub", { u: unit })} empty={inRange.length === 0}
        table={{ head: [range === "week" ? t("chart.date") : t("chart.week"), `${t("stat.volume")} (${unit})`], rows: volBarsDisp.map(b => [b.label, nf.format(b.value)]) }}>
        <BarChart bars={volBarsDisp} fmtY={v => nf.format(v)} label={t("pc.volume")} />
      </ChartFrame>

      <ChartFrame title={t("pc.muscleSets")} subtitle={latest ? t("pc.muscleSetsSub", { date: short(latest.weekStart) }) : undefined} empty={muscleRows.length === 0}
        table={{ head: [t("lib.muscles"), t("stat.sets"), "MEV", "MRV"], rows: muscleRows.map(r => [t(`muscle.${r.muscle}`), r.sets, r.band.mev, r.band.mrv]) }}>
        <MuscleBars rows={muscleRows} />
      </ChartFrame>

      {heatWeeks.length > 1 && trained.length > 0 && (
        <ChartFrame title={t("pc.muscleHeat")}
          table={{ head: [t("lib.muscles"), ...heatWeeks.map(w => short(w.weekStart))], rows: trained.map(m => [t(`muscle.${m}`), ...heatWeeks.map(w => Math.round((w.sets[m] ?? 0) * 10) / 10)]) }}>
          <Heatmap label={t("pc.muscleHeat")} thresholds={[4, 8, 12, 16, 20]} legendLabels={[t("chart.less"), t("chart.more")]}
            caption={[short(heatWeeks[0].weekStart), short(heatWeeks[heatWeeks.length - 1].weekStart)]}
            rows={trained.map(m => ({
              key: m, label: t(`muscle.${m}`),
              cells: heatWeeks.map(w => ({ key: w.weekStart, value: w.sets[m] ?? 0, label: t("pc.cellSets", { muscle: t(`muscle.${m}`), date: short(w.weekStart), n: Math.round((w.sets[m] ?? 0) * 10) / 10 }) })),
            }))} />
        </ChartFrame>
      )}

      <ChartFrame title={t("pc.calendar")} subtitle={t("pc.calendarSub")} empty={false}
        table={{ head: [t("chart.date"), t("stat.sets")], rows: [...daily.entries()].filter(([k]) => k >= calStart).sort((a, b) => b[0].localeCompare(a[0])).map(([k, n]) => [formatDayKey(k, lang, { year: "numeric", month: "short", day: "numeric" }), n]) }}>
        <Heatmap label={t("pc.calendar")} thresholds={[5, 10, 15, 20, 25]} legendLabels={[t("chart.less"), t("chart.more")]} cell={13}
          caption={[formatDayKey(calStart, lang, { year: "numeric", month: "short", day: "numeric" }), formatDayKey(today, lang, { year: "numeric", month: "short", day: "numeric" })]}
          rows={[0, 1, 2, 3, 4, 5, 6].map(d => ({
            key: String(d), label: d % 2 === 0 ? formatDayKey(addDays(calStart, d), lang, { weekday: "short" }) : "",
            cells: calCols.map(c => { const k = addDays(c, d); const n = k > today ? 0 : daily.get(k) ?? 0; return { key: k, value: n, outline: k === today, label: t("pc.daySets", { date: formatDayKey(k, lang, { month: "short", day: "numeric" }), n }) }; }),
          }))} />
      </ChartFrame>

      <ChartFrame title={t("pc.duration")} empty={durations.length === 0}
        table={{ head: [t("chart.date"), t("wk.sumDuration")], rows: durations.map(d => [formatDayKey(d.dayKey, lang, { month: "short", day: "numeric" }), t("pc.minutes", { n: d.minutes })]) }}>
        <BarChart bars={durations.slice(-30).map((d, i) => ({ key: d.dayKey + i, label: short(d.dayKey), value: d.minutes, tip: `${d.name || t("wk.quick")} · ${t("pc.minutes", { n: d.minutes })}` }))} fmtY={v => String(v)} label={t("pc.duration")} color="var(--series-1)" />
      </ChartFrame>

      <section className="card grid gap-2" aria-label={t("pc.prs")}>
        <h2 className="font-bold">🏆 {t("pc.prs")}</h2>
        {prs.length === 0 ? <p className="muted text-sm">{t("pc.noPrs")}</p> : (
          <ol className="grid gap-1 text-sm">
            {prs.slice(0, 15).map((p, i) => (
              <li key={i} className="flex gap-2"><span className="muted w-16 shrink-0">{short(p.dayKey)}</span><span>{lib.byId(p.exerciseId)?.name[lang]}: {prText(p, unit, t)}</span></li>
            ))}
          </ol>
        )}
      </section>

      <GoalsView body={body} workouts={workouts} lib={lib} today={today} />
    </div>
  );
}
