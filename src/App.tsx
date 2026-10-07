import { lazy, Suspense, useMemo, useState } from "react";
import { useApp } from "./app-context";
import TabBar, { type Tab } from "./components/TabBar";
import BackupNotice from "./components/BackupNotice";
import { repo } from "./db";
import { SCHEMA_VERSION } from "./db/types";
import { newId } from "./lib/id";
import { useLibrary } from "./library/useLibrary";
import { mesoPosition, trainingDayNumber } from "./program/schedule";
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
  const { settings, loaded, update } = useApp();
  const [tab, setTab] = useState<Tab>("today");
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

  if (!loaded || !prog.ready || !hist.ready) return null;

  // First run: no settings flag and nothing logged yet. Existing data marks the user as onboarded.
  const firstRun = !settings.onboarded && prog.programs.length === 0 && hist.workouts.length === 0;
  if (!settings.onboarded && !firstRun) void update({ onboarded: true });

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: active || firstRun ? undefined : "calc(5rem + env(safe-area-inset-bottom))" }}>
        <Suspense fallback={<p className="muted" role="status">…</p>}>
          {firstRun ? (
            <Onboarding prog={prog} onDone={() => setTab("today")} />
          ) : active ? (
            <Workout key={active.id} initial={active} lib={lib} history={hist.finished} onExit={() => void close()} onClose={() => void close()} />
          ) : (
            <>
              <BackupNotice />
              {tab === "today" ? (
                <Today prog={prog} lib={lib} hist={hist} selected={selectedDay} setSelected={setSelectedDay} onStart={(s, d) => void start(s, d)} goProgram={() => setTab("program")} />
              ) : tab === "program" ? (
                <Program prog={prog} lib={lib} />
              ) : tab === "progress" ? (
                <Progress lib={lib} hist={hist} prog={prog} />
              ) : tab === "coach" ? (
                <Coach prog={prog} lib={lib} finished={hist.finished} />
              ) : (
                <Settings lib={lib} prog={prog} workouts={hist.finished} />
              )}
            </>
          )}
        </Suspense>
      </main>
      {!active && !firstRun && <TabBar tab={tab} onChange={setTab} />}
    </>
  );
}
