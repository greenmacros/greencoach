import { useApp } from "../app-context";

export const TABS = ["today", "program", "progress", "coach", "settings"] as const;
export type Tab = (typeof TABS)[number];

const ICONS: Record<Tab, string> = {
  today: "M3 11l9-8 9 8v10H3z",
  program: "M4 5h16M4 12h16M4 19h10",
  progress: "M4 20V10m6 10V4m6 16v-8m4 8H2",
  coach: "M12 3a7 7 0 00-4 12.7V19h8v-3.3A7 7 0 0012 3zM9 22h6",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3m12 0h3M12 3v3m0 12v3",
};

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useApp();
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 border-t flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map(id => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-current={tab === id ? "page" : undefined}
          className="flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold bg-transparent border-0 cursor-pointer"
          style={{ color: tab === id ? "var(--accent)" : "var(--muted)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICONS[id]} />
          </svg>
          {t(`tab.${id}`)}
        </button>
      ))}
    </nav>
  );
}
