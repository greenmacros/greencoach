import { useState } from "react";
import { useApp } from "./app-context";
import TabBar, { type Tab } from "./components/TabBar";
import BackupNotice from "./components/BackupNotice";
import Settings from "./pages/Settings";
import Soon from "./pages/Soon";

export default function App() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
        <BackupNotice />
        {tab === "settings" ? <Settings /> : <Soon title={t(`tab.${tab}`)} />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
