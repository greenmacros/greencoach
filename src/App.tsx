import { useState } from "react";
import { useApp } from "./app-context";
import TabBar, { type Tab } from "./components/TabBar";
import BackupNotice from "./components/BackupNotice";
import { useLibrary } from "./library/useLibrary";
import { useProgram } from "./program/useProgram";
import Program from "./pages/Program";
import Settings from "./pages/Settings";
import Soon from "./pages/Soon";
import Today from "./pages/Today";

export default function App() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const lib = useLibrary();
  const prog = useProgram();
  const [workout, setWorkout] = useState<{ sessionId: string | null; dayKey: string } | null>(null);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
        <BackupNotice />
        {workout ? (
          <section className="grid gap-3">
            <p className="card">{t("today.workoutSoon")}</p>
            <button className="btn" onClick={() => setWorkout(null)}>{t("today.back")}</button>
          </section>
        ) : tab === "today" ? (
          <Today prog={prog} lib={lib} onStart={(sessionId, dayKey) => setWorkout({ sessionId, dayKey })} goProgram={() => setTab("program")} />
        ) : tab === "program" ? (
          <Program prog={prog} lib={lib} />
        ) : tab === "settings" ? (
          <Settings />
        ) : (
          <Soon title={t(`tab.${tab}`)} />
        )}
      </main>
      <TabBar tab={tab} onChange={t => { setWorkout(null); setTab(t); }} />
    </>
  );
}
