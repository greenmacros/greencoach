import { useApp } from "../app-context";

export const TABS = ["today", "program", "progress", "coach", "settings"] as const;
export type Tab = (typeof TABS)[number];

/** Visual order: the workout tab sits in the middle as the main action. */
const ORDER: Tab[] = ["program", "progress", "today", "coach", "settings"];

const ICONS: Record<Tab, string> = {
  today: "M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11", // dumbbell
  program: "M4 5h16M4 12h16M4 19h10",
  progress: "M4 20V10m6 10V4m6 16v-8m4 8H2",
  coach: "M12 3a7 7 0 00-4 12.7V19h8v-3.3A7 7 0 0012 3zM9 22h6",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3m12 0h3M12 3v3m0 12v3",
};

const Icon = ({ id, size }: { id: Tab; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[id]} />
  </svg>
);

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useApp();
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 border-t flex items-end"
      style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 10 }}>
      {ORDER.map(id => {
        const current = tab === id;
        if (id === "today")
          return (
            <button key={id} type="button" onClick={() => onChange(id)} aria-current={current ? "page" : undefined}
              className="flex-1 flex flex-col items-center gap-0.5 text-xs font-bold bg-transparent border-0 cursor-pointer"
              style={{ color: "var(--accent)", paddingBottom: 6 }}>
              <span className="grid place-items-center"
                style={{ width: 62, height: 62, marginTop: -26, borderRadius: 999, background: "var(--accent)", color: "var(--accent-fg)",
                  border: "4px solid var(--surface)", boxShadow: current ? "0 0 0 2px var(--accent), 0 6px 16px rgb(0 0 0 / 0.25)" : "0 6px 16px rgb(0 0 0 / 0.25)" }}>
                <Icon id={id} size={30} />
              </span>
              {t("tab.workout")}
            </button>
          );
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-current={current ? "page" : undefined}
            className="flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold bg-transparent border-0 cursor-pointer"
            style={{ color: current ? "var(--accent)" : "var(--muted)" }}>
            <Icon id={id} size={22} />
            {t(`tab.${id}`)}
          </button>
        );
      })}
    </nav>
  );
}
