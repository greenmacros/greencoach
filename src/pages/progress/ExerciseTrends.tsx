import { useMemo, useState } from "react";
import { useApp } from "../../app-context";
import ChartFrame from "../../charts/ChartFrame";
import LineChart from "../../charts/LineChart";
import ExerciseHistory from "../../components/ExerciseHistory";
import { formatDayKey, fmtWeight } from "../../lib/format";
import type { LibraryApi } from "../../library/useLibrary";
import { exerciseSeries, inRange, loggedExercises, rangeStart } from "../../progress/stats";
import type { Range } from "../../progress/types";
import type { WorkoutLog } from "../../workout/types";

export default function ExerciseTrends({ range, workouts, lib, today }: { range: Range; workouts: WorkoutLog[]; lib: LibraryApi; today: string }) {
  const { t, settings } = useApp();
  const { lang, weightUnit: unit } = settings;
  const options = useMemo(() => loggedExercises(workouts), [workouts]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hist, setHist] = useState(false);
  const id = picked ?? options[0]?.exerciseId ?? null;
  const start = rangeStart(range, today);
  const series = useMemo(() => (id ? exerciseSeries(workouts, id).filter(p => inRange(p.dayKey, start, today)) : []), [id, workouts, start, today]);
  const ex = id ? lib.byId(id) : undefined;

  if (!options.length) return <p className="card muted">{t("pc.noExercises")}</p>;
  const w = (kg: number) => Number(fmtWeight(Math.round(kg * 10) / 10, unit));
  const fmtX = (k: string) => formatDayKey(k, lang, { month: "short", day: "numeric" });

  return (
    <div className="grid gap-3">
      <label className="grid gap-1"><span className="font-semibold">{t("pc.exercise")}</span>
        <select className="field" value={id ?? ""} onChange={e => setPicked(e.target.value)}>
          {options.map(o => <option key={o.exerciseId} value={o.exerciseId}>{lib.byId(o.exerciseId)?.name[lang] ?? o.exerciseId} ({t("pc.sessions", { n: o.sessions })})</option>)}
        </select>
      </label>
      <ChartFrame title={t("pc.exerciseTrend", { name: ex?.name[lang] ?? "" })} empty={series.length === 0}
        legend={[{ label: t("pc.e1rm"), color: "var(--series-1)" }, { label: t("pc.topSet"), color: "var(--series-2)" }]}
        table={{ head: [t("chart.date"), `${t("pc.e1rm")} (${unit})`, `${t("pc.topSet")} (${unit})`], rows: [...series].reverse().map(p => [fmtX(p.dayKey), w(p.e1rm), `${w(p.topKg)} × ${p.topReps}`]) }}>
        <LineChart label={t("pc.exerciseTrend", { name: ex?.name[lang] ?? "" })} fmtX={fmtX} fmtY={v => `${Math.round(v * 10) / 10}`}
          series={[
            { id: "e1rm", label: t("pc.e1rm"), color: "var(--series-1)", points: series.map(p => ({ x: p.dayKey, y: w(p.e1rm) })) },
            { id: "top", label: t("pc.topSet"), color: "var(--series-2)", points: series.map(p => ({ x: p.dayKey, y: w(p.topKg) })) },
          ]} />
      </ChartFrame>
      {ex && <button className="btn" onClick={() => setHist(true)}>{t("pc.openHistory")}</button>}
      {hist && ex && <ExerciseHistory ex={ex} workouts={workouts} onClose={() => setHist(false)} />}
    </div>
  );
}
