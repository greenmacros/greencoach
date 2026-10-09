import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "./app-context";
import TabBar, { type Tab } from "./components/TabBar";
import BackupNotice from "./components/BackupNotice";
import { repo } from "./db";
import { SCHEMA_VERSION } from "./db/types";
import { newId } from "./lib/id";
import { useLibrary } from "./library/useLibrary";
import { mesoPosition, trainingDayNumber, weekStart } from "./program/schedule";
import type { AutoRecord } from "./coach/auto";
import AutoCoachCard from "./components/AutoCoachCard";
import ImportPlanSheet from "./components/ImportPlanSheet";
import { SafetyGate } from "./components/Safety";
import type { SharedPlan } from "./program/share";
import { useProgram } from "./program/useProgram";
import { createWorkout } from "./workout/model";
import type { WorkoutLog } from "./workout/types";
import { useHistory } from "./workout/useHistory";
import Today from "./pages/Today";

// Everything except Today loads on demand to keep the first paint small.
const Program = lazy(() => import("./pages/Program"));
const Progress = lazy(() => import("./pages/Progress"));
const Coach = lazy(() => import("./pages/Coach"));
const Settings = lazy(() => import("./pages/Settings"));
const Workout = lazy(() => import("./pages/Workout"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

export default function App() {
  const { settings, loaded, update, profile, t } = useApp();
  const [tab, setTabState] = useState<Tab>("today");
  const [coachTarget, setCoachTarget] = useState<"this" | undefined>();
  const setTab = (t: Tab) => { setCoachTarget(undefined); setTabState(t); };
  const lib = useLibrary();
  const hist = useHistory();
  const completed = useMemo(() => new Set(hist.finished.map(w => w.dayKey)), [hist.finished]);
  const prog = useProgram(completed);
  const [active, setActive] = useState<WorkoutLog | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const start = async (sessionId: string | null, dayKey: string) => {
    const program = prog.active;
    const session = program?.sessions.find(s => s.id === sessionId) ?? null;
    // Resume an existing draft of the same session on the same day instead of starting over.
    const draft = hist.drafts.find(d => d.dayKey === dayKey && d.sessionId === (session?.id ?? null));
    if (draft) return setActive(draft);
    const base = createWorkout({
      dayKey, programId: program?.id ?? null, session, unit: settings.weightUnit, history: hist.finished,
      mesoWeek: program ? mesoPosition(program, dayKey).week : undefined,
      mesoDay: program && session ? trainingDayNumber(program, dayKey) : undefined,
    });
    const saved = (await repo.put("workouts", { ...base, id: newId(), schemaVersion: SCHEMA_VERSION } as never)) as unknown as WorkoutLog;
    setActive(saved);
  };

  const close = async () => { setActive(null); await hist.reload(); };

  // Opened from a shared-plan link (#plan=…): offer to import it.
  const [shared, setShared] = useState<SharedPlan | "bad" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  useEffect(() => {
    const read = () => void import("./program/share").then(async m => {
      const code = m.codeFromHash(location.hash);
      if (code) setShared(await m.decodePlan(code).catch(() => "bad" as const));
    });
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const clearShared = () => { setShared(null); history.replaceState(null, "", location.pathname + location.search); };
  const importShared = async () => {
    if (!shared || shared === "bad") return;
    setImporting(true);
    const m = await import("./program/share");
    const ids = new Map<string, string>();
    for (const c of shared.c ?? []) {
      const ex = await lib.saveCustom({ nameEn: c.en, nameJa: c.ja, primary: c.p, secondary: c.s, equipment: c.eq, pattern: c.pat, mechanic: c.m, fatigue: c.f, notes: c.notes });
      ids.set(c.id, ex.id);
    }
    for (const p of prog.programs) if (p.active) await repo.put("programs", { ...p, active: false } as never);
    const saved = await prog.save({ ...m.fromShared(shared, prog.todayKey, ids), schemaVersion: SCHEMA_VERSION } as never);
    setImporting(false);
    clearShared();
    setImportMsg(t("share.done", { name: saved.name }));
    setTab("program");
  };

  // Automatic coaching: once per week, on the first open, the coach applies this week's changes (or asks for review).
  const [auto, setAuto] = useState<AutoRecord | null>(null);
  const program = prog.active;
  useEffect(() => {
    if (!loaded || !prog.ready || !hist.ready || !lib.ready || !program || active) return;
    if (settings.coachMode === "ask") return setAuto(null);
    let live = true;
    void import("./coach/auto")
      .then(m => m.runAutoCoach({ program, save: prog.save, finished: hist.finished, lib, profile, settings, today: prog.todayKey }))
      .then(r => { if (live) setAuto(r); });
    return () => { live = false; };
    // Re-run only when the inputs that matter change (not on every program save, which the run itself causes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, prog.ready, hist.ready, lib.ready, program?.id, prog.todayKey, hist.finished.length, settings.coachMode, active === null]);
  const autoAct = (fn: (m: typeof import("./coach/auto")) => Promise<AutoRecord>) => void import("./coach/auto").then(fn).then(setAuto);
  const coachChanges = useMemo(
    () => (auto?.status === "applied" && active && weekStart(active.dayKey) === auto.weekKey ? new Map(auto.changes.map(c => [c.slotId, c])) : undefined),
    [auto, active],
  );

  if (!loaded || !prog.ready || !hist.ready) return null;

  // First run: no settings flag and nothing logged yet. Existing data marks the user as onboarded.
  const firstRun = !settings.onboarded && prog.programs.length === 0 && hist.workouts.length === 0;
  if (!settings.onboarded && !firstRun) void update({ onboarded: true });

  return (
    <>
      <main className="mx-auto max-w-2xl px-4" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: active || firstRun ? undefined : "calc(6.5rem + env(safe-area-inset-bottom))" }}>
        <Suspense fallback={<p className="muted" role="status">…</p>}>
          {firstRun ? (
            <Onboarding prog={prog} onDone={() => setTab("today")} />
          ) : active ? (
            <Workout key={active.id} initial={active} lib={lib} history={hist.finished} coachChanges={coachChanges} onExit={() => void close()} onClose={() => void close()} />
          ) : (
            <>
              <BackupNotice />
              {tab === "today" ? (
                <Today prog={prog} lib={lib} hist={hist} selected={selectedDay} setSelected={setSelectedDay} onStart={(s, d) => void start(s, d)} goProgram={() => setTab("program")}
                  banner={auto && !auto.seen && program ? (
                    <AutoCoachCard rec={auto} lib={lib}
                      onDismiss={() => autoAct(m => m.dismissAutoCoach(auto))}
                      onUndo={() => autoAct(m => m.undoAutoCoach(auto, program, prog.save))}
                      onReview={() => { setTabState("coach"); setCoachTarget("this"); }} />
                  ) : null} />
              ) : tab === "program" ? (
                <Program prog={prog} lib={lib} />
              ) : tab === "progress" ? (
                <Progress lib={lib} hist={hist} prog={prog} />
              ) : tab === "coach" ? (
                <Coach prog={prog} lib={lib} finished={hist.finished} initialTarget={coachTarget} />
              ) : (
                <Settings lib={lib} prog={prog} workouts={hist.finished} />
              )}
            </>
          )}
        </Suspense>
      </main>
      {!active && !firstRun && <TabBar tab={tab} onChange={setTab} />}
      {!settings.safetyAcceptedAt && <SafetyGate />}
      {shared && lib.ready && <ImportPlanSheet plan={shared} lib={lib} busy={importing} onImport={() => void importShared()} onCancel={clearShared} />}
      {importMsg && (
        <div role="status" className="card flex items-center gap-3 fixed left-4 right-4 mx-auto max-w-xl" style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))", zIndex: 40, borderColor: "var(--accent)" }}>
          <span className="flex-1 font-semibold">{importMsg}</span>
          <button className="btn" onClick={() => setImportMsg("")}>{t("auto.ok")}</button>
        </div>
      )}
    </>
  );
}
