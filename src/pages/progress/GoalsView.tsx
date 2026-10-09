import { useApp } from "../../app-context";
import { formatDayKey, fmtWeight } from "../../lib/format";
import type { LibraryApi } from "../../library/useLibrary";
import { goalProgress } from "../../progress/stats";
import type { BodyApi } from "../../progress/useBody";
import type { GoalRecord } from "../../progress/types";
import type { WorkoutLog } from "../../workout/types";
import Icon from "../../components/Icon";

export function goalTitle(g: GoalRecord, t: ReturnType<typeof useApp>["t"], lib: LibraryApi, lang: "en" | "ja", unit: "kg" | "lb"): string {
  if (g.kind === "lift") return t("goal.lift", { name: lib.byId(g.exerciseId ?? "")?.name[lang] ?? "?", target: fmtWeight(g.targetKg ?? 0, unit), u: unit });
  if (g.kind === "bodyweight") return t("goal.bw", { target: fmtWeight(g.targetKg ?? 0, unit), u: unit });
  return t("goal.sessions", { n: g.perWeek ?? 0 });
}

/** Low-prominence goal progress, shown at the end of the Progress overview. */
export default function GoalsView({ body, workouts, lib, today }: { body: BodyApi; workouts: WorkoutLog[]; lib: LibraryApi; today: string }) {
  const { t, settings } = useApp();
  const { lang, weightUnit: unit } = settings;
  return (
    <section className="card grid gap-3" aria-label={t("goal.title")}>
      <h2 className="font-bold">{t("goal.title")}</h2>
      {body.goals.length === 0 && <p className="muted text-sm">{t("goal.none")}</p>}
      {body.goals.map(g => {
        const p = goalProgress(g, workouts, body.metrics, today);
        const title = goalTitle(g, t, lib, lang, unit);
        const pct = Math.round(p.fraction * 100);
        return (
          <div key={g.id} className="grid gap-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-semibold">{title}{g.targetDate ? ` · ${t("goal.byDate", { date: formatDayKey(g.targetDate, lang, { year: "numeric", month: "short", day: "numeric" }) })}` : ""}</span>
              <span className="muted">{p.achieved ? <><Icon name="check" /> {t("goal.achieved")}</> : `${pct}%`}</span>
            </div>
            <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: 8, background: "var(--band)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: p.achieved ? "var(--accent)" : "var(--series-1)", borderRadius: 4 }} />
            </div>
            <p className="muted text-xs">
              {p.current !== null && t("goal.now", { v: g.kind === "sessions" ? String(p.current) : `${fmtWeight(Math.round(p.current * 10) / 10, unit)} ${unit}` })}
              {!p.achieved && g.kind !== "sessions" && ` · ${p.projected ? t("goal.projected", { date: formatDayKey(p.projected, lang, { year: "numeric", month: "short", day: "numeric" }) }) : t("goal.noProjection")}`}
            </p>
          </div>
        );
      })}
    </section>
  );
}
