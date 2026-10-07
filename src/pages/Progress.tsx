import { useState } from "react";
import { useApp } from "../app-context";
import type { LibraryApi } from "../library/useLibrary";
import type { ProgramApi } from "../program/useProgram";
import { RANGES, type Range } from "../progress/types";
import { useBody } from "../progress/useBody";
import type { useHistory } from "../workout/useHistory";
import History from "./History";
import BodyView from "./progress/BodyView";
import ExerciseTrends from "./progress/ExerciseTrends";
import Overview from "./progress/Overview";

type View = "overview" | "exercises" | "body" | "history";

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience */ } };

export default function Progress({ lib, hist, prog }: { lib: LibraryApi; hist: ReturnType<typeof useHistory>; prog: ProgramApi }) {
  const { t } = useApp();
  const body = useBody();
  const [range, setRangeState] = useState<Range>(() => (RANGES as string[]).includes(lsGet("gc_range") ?? "") ? (lsGet("gc_range") as Range) : "3months");
  const [view, setView] = useState<View>("overview");
  const setRange = (r: Range) => { setRangeState(r); lsSet("gc_range", r); };

  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-bold">{t("progress.title")}</h1>
      <div className="seg" role="group" aria-label={t("tab.progress")}>
        {(["overview", "exercises", "body", "history"] as View[]).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{t(`prog2.${v}`)}</button>)}
      </div>
      {view !== "history" && (
        <div className="hscroll" role="group" aria-label={t("range.label")}>
          {RANGES.map(r => <button key={r} className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>{t(`range.${r}`)}</button>)}
        </div>
      )}
      {view === "overview" && <Overview range={range} workouts={hist.finished} lib={lib} prog={prog} body={body} />}
      {view === "exercises" && <ExerciseTrends range={range} workouts={hist.finished} lib={lib} today={prog.todayKey} />}
      {view === "body" && <BodyView range={range} body={body} today={prog.todayKey} />}
      {view === "history" && <History lib={lib} hist={hist} />}
    </section>
  );
}
