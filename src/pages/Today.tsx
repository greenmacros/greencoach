import { useState, type ReactNode } from "react";
import { useApp } from "../app-context";
import { formatDayKey, formatDayLong, weekdayLong, weekdayShort } from "../lib/format";
import { estimateMinutes, mesoPosition, movePatch, skipPatch, totalSets, unskipPatch, weekDays } from "../program/schedule";
import type { ProgramApi } from "../program/useProgram";
import type { LibraryApi } from "../library/useLibrary";
import type { DayOverride } from "../program/types";
import { repo } from "../db";
import type { useHistory } from "../workout/useHistory";

interface Props {
  prog: ProgramApi;
  lib: LibraryApi;
  hist: ReturnType<typeof useHistory>;
  /** Selected day (null = today); lives in App so it survives opening a workout. */
  selected: string | null;
  setSelected: (k: string | null) => void;
  onStart: (sessionId: string | null, dayKey: string) => void;
  goProgram: () => void;
  /** Shown under the heading, e.g. the automatic coach summary. */
  banner?: ReactNode;
}

export default function Today({ prog, lib, hist, selected, setSelected, onStart, goProgram, banner }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [moving, setMoving] = useState(false);
  const [undo, setUndo] = useState<{ before: DayOverride[]; touched: string[]; text: string } | null>(null);

  const dayKey = selected ?? prog.todayKey;
  const program = prog.active;

  if (!prog.ready) return null;

  if (!program) {
    return (
      <section className="grid gap-3">
        <h1 className="text-2xl font-bold">{t("today.title")}</h1>
        <div className="card grid gap-2">
          <p className="font-semibold">{t("today.noProgram")}</p>
          <p className="muted">{t("today.noProgramBody")}</p>
          <button className="btn btn-primary" onClick={goProgram}>{t("today.choose")}</button>
        </div>
      </section>
    );
  }

  const day = prog.resolve(dayKey)!;
  const session = program.sessions.find(s => s.id === day.sessionId);
  const meso = mesoPosition(program, dayKey);
  const days = weekDays(dayKey);
  const draft = hist.drafts[0];

  const run = async (patches: ReturnType<typeof skipPatch>, text: string) => {
    const touched = patches.map(p => p.dayKey);
    const before = await prog.applyPatches(patches);
    setUndo({ before, touched, text });
  };

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">{dayKey === prog.todayKey ? t("today.title") : formatDayLong(dayKey, lang)}</h1>
        <p className="muted">
          {dayKey === prog.todayKey ? formatDayLong(dayKey, lang) + " · " : ""}
          {meso.started ? (meso.isDeload ? t("today.deload") : t("today.week", { n: meso.week, m: meso.total })) : t("today.notStarted", { date: formatDayKey(program.mesoStartDayKey, lang, { month: "short", day: "numeric" }) })}
          {meso.started && meso.isDeload ? ` (${meso.week}/${meso.total})` : ""}
        </p>
      </div>
      {banner}

      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Week">
        {days.map(k => {
          const r = prog.resolve(k)!;
          const sel = k === dayKey, isToday = k === prog.todayKey;
          const label = program.sessions.find(s => s.id === r.sessionId)?.name ?? t("prog.rest");
          return (
            <button key={k} onClick={() => { setSelected(k === prog.todayKey ? null : k); setMoving(false); }} aria-pressed={sel}
              aria-label={`${weekdayLong(k, lang)}, ${label}${r.status === "done" ? ", " + t("today.done") : r.status === "skipped" ? ", " + t("today.skipped") : ""}`}
              className="flex flex-col items-center gap-0.5 py-2 rounded-xl cursor-pointer"
              style={{
                border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: sel ? "var(--accent)" : "var(--surface)",
                color: sel ? "var(--accent-fg)" : "var(--text)", font: "inherit",
              }}>
              <span className="text-xs">{weekdayShort(k, lang)}</span>
              <span className="font-bold">{formatDayKey(k, lang, { day: "numeric" })}</span>
              <span aria-hidden="true" className="text-xs" style={{ minHeight: 16 }}>
                {r.status === "done" ? "✓" : r.status === "skipped" ? "⤼" : r.sessionId ? "●" : "·"}
              </span>
            </button>
          );
        })}
      </div>

      {draft && (
        <div className="card flex flex-wrap items-center gap-2" style={{ borderColor: "var(--accent)" }} role="status">
          <span className="flex-1 min-w-40"><strong>{t("wk.resume")}</strong><br /><span className="muted text-sm">{draft.sessionName || t("wk.quick")} · {formatDayLong(draft.dayKey, lang)}</span></span>
          <button className="btn btn-primary" onClick={() => onStart(draft.sessionId, draft.dayKey)}>{t("wk.resumeBtn")}</button>
          <button className="btn btn-danger" onClick={async () => { await repo.remove("workouts", draft.id); await hist.reload(); }}>{t("wk.discard")}</button>
        </div>
      )}

      {selected && <button className="btn" onClick={() => { setSelected(null); setMoving(false); }}>{t("today.backToToday")}</button>}

      {session ? (
        <div className="card grid gap-3" aria-label={session.name}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">{session.name}</h2>
              <p className="muted text-sm">{t("today.exercises", { n: session.exercises.length, sets: totalSets(session), min: estimateMinutes(session) })}</p>
            </div>
            {day.status === "done" && <span className="chip" aria-pressed="true">✓ {t("today.done")}</span>}
            {day.status === "skipped" && <span className="chip">{t("today.skipped")}</span>}
          </div>
          <ol className="grid gap-1 text-sm">
            {session.exercises.map(sl => {
              const ex = lib.byId(sl.exerciseId);
              return (
                <li key={sl.id} className="flex justify-between gap-2">
                  <span className="min-w-0">{sl.supersetGroup !== null ? "⇄ " : ""}{ex ? ex.name[lang] : t("prog.missing")}</span>
                  <span className="muted whitespace-nowrap">{t("today.sets", { n: sl.sets, lo: sl.repMin, hi: sl.repMax })}</span>
                </li>
              );
            })}
          </ol>
          {day.status !== "done" && (
            <button className="btn btn-primary" style={{ minHeight: 56, fontSize: 18 }} onClick={() => onStart(session.id, dayKey)}>{t("today.start")}</button>
          )}
          {day.status !== "done" && (
            <div className="flex flex-wrap gap-2">
              {day.status === "skipped"
                ? <button className="btn" onClick={() => void run(unskipPatch(program, day), t("today.unskip"))}>{t("today.unskip")}</button>
                : <button className="btn" onClick={() => void run(skipPatch(day), t("today.skipped"))}>{t("today.skip")}</button>}
              <button className="btn" aria-expanded={moving} onClick={() => setMoving(m => !m)}>{t("today.move")}</button>
            </div>
          )}
          {moving && (
            <div className="grid gap-2" role="group" aria-label={t("today.moveTo", { name: session.name })}>
              <p className="font-semibold">{t("today.moveTo", { name: session.name })}</p>
              <p className="muted text-sm">{t("today.moveHint")}</p>
              <div className="flex flex-wrap gap-2">
                {days.filter(k => k !== dayKey).map(k => {
                  const r = prog.resolve(k)!;
                  const other = program.sessions.find(s => s.id === r.sessionId);
                  return (
                    <button key={k} className="chip" onClick={async () => { setMoving(false); await run(movePatch(program, day, r), t("today.moved")); }}>
                      {weekdayShort(k, lang)} {formatDayKey(k, lang, { day: "numeric" })}{other ? ` ⇄ ${other.name}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card grid gap-2">
          <h2 className="text-xl font-bold">{t("today.rest")}</h2>
          <p className="muted">{t("today.restBody")}</p>
          <button className="btn" onClick={() => onStart(null, dayKey)}>{t("today.quick")}</button>
        </div>
      )}

      {undo && (
        <div role="status" className="card flex items-center gap-3 fixed left-4 right-4 mx-auto max-w-xl" style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))", zIndex: 40 }}>
          <span className="flex-1">{undo.text}</span>
          <button className="btn" onClick={async () => { await prog.restoreOverrides(undo.before, undo.touched); setUndo(null); }}>{t("today.undo")}</button>
          <button className="btn" aria-label={t("lib.close")} onClick={() => setUndo(null)}>✕</button>
        </div>
      )}
    </section>
  );
}
