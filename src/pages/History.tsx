import { useMemo, useState } from "react";
import { useApp } from "../app-context";
import ExerciseHistory from "../components/ExerciseHistory";
import WorkoutDetail from "../components/WorkoutDetail";
import { repo } from "../db";
import { formatClock, formatDayKey, formatDayLong, fmtWeight } from "../lib/format";
import type { Exercise } from "../library/types";
import type { LibraryApi } from "../library/useLibrary";
import { summarize } from "../workout/model";
import { computeAllPRs } from "../workout/pr";
import type { WorkoutLog } from "../workout/types";
import type { useHistory } from "../workout/useHistory";

export default function History({ lib, hist }: { lib: LibraryApi; hist: ReturnType<typeof useHistory> }) {
  const { t, settings } = useApp();
  const lang = settings.lang, unit = settings.weightUnit;
  const [open, setOpen] = useState<WorkoutLog | null>(null);
  const [exHist, setExHist] = useState<Exercise | null>(null);
  const [undo, setUndo] = useState<WorkoutLog | null>(null);

  const prs = useMemo(() => computeAllPRs(hist.finished), [hist.finished]);
  const groups = useMemo(() => {
    const m = new Map<string, WorkoutLog[]>();
    for (const w of hist.finished) { const k = w.dayKey.slice(0, 7); m.set(k, [...(m.get(k) ?? []), w]); }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [hist.finished]);

  const remove = async (w: WorkoutLog) => {
    await repo.remove("workouts", w.id);
    setOpen(null);
    setUndo(w);
    await hist.reload();
  };

  return (
    <section className="grid gap-3" aria-label={t("hist.title")}>
      {hist.ready && hist.finished.length === 0 && <p className="card muted">{t("hist.empty")}</p>}
      {groups.map(([month, list]) => (
        <div key={month} className="grid gap-2">
          <h2 className="font-bold text-lg">{formatDayKey(month + "-01", lang, { year: "numeric", month: "long" })}</h2>
          {list.map(w => {
            const s = summarize(w, lib.byId);
            const n = prs.get(w.id)?.length ?? 0;
            return (
              <button key={w.id} className="card text-left grid gap-1 cursor-pointer" style={{ font: "inherit", color: "var(--text)" }} onClick={() => setOpen(w)}>
                <span className="flex justify-between gap-2"><span className="font-bold">{w.sessionName || t("wk.quick")}</span><span className="muted text-sm">{formatDayLong(w.dayKey, lang)}</span></span>
                <span className="muted text-sm">{formatClock(s.durationSec)} · {fmtWeight(s.volumeKg, unit)} {unit} · {t("hist.sets", { n: s.workingSets })}{n > 0 ? ` · 🏆 ${t("hist.prs", { n })}` : ""}</span>
              </button>
            );
          })}
        </div>
      ))}

      {open && <WorkoutDetail workout={open} workouts={hist.finished} lookup={lib.byId} onClose={() => setOpen(null)} onDelete={w => void remove(w)} onExercise={ex => setExHist(ex)} />}
      {exHist && <ExerciseHistory ex={exHist} workouts={hist.finished} onClose={() => setExHist(null)} />}

      {undo && (
        <div role="status" className="card flex items-center gap-3 fixed left-4 right-4 mx-auto max-w-xl" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))", zIndex: 40 }}>
          <span className="flex-1">{t("hist.deleted")}</span>
          <button className="btn" onClick={async () => { await repo.put("workouts", undo as never); setUndo(null); await hist.reload(); }}>{t("hist.undo")}</button>
          <button className="btn" aria-label={t("lib.close")} onClick={() => setUndo(null)}>✕</button>
        </div>
      )}
    </section>
  );
}
