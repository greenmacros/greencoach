import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { repo } from "./db";
import { SETTINGS_ID, defaultSettings } from "./db/defaults";
import type { Settings } from "./db/types";
import { detectLang, translate, type TFn } from "./i18n/translate";

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  t: TFn;
  /** Bumps after import/delete so screens reload their data. */
  dataVersion: number;
  reloadAll: () => Promise<void>;
}

const AppContext = createContext<Ctx | null>(null);

export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* non-essential */ } };

function applyTheme(pref: Settings["theme"]) {
  const dark = pref === "dark" || (pref === "system" && !matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0f14" : "#f6f7f9");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...defaultSettings(detectLang(lsGet("gc_lang"))),
    theme: (["system", "light", "dark"].includes(lsGet("gc_theme_pref") ?? "") ? lsGet("gc_theme_pref") : "system") as Settings["theme"],
  }));
  const [dataVersion, setDataVersion] = useState(0);

  const load = useCallback(async () => {
    const stored = await repo.get<Settings>("settings", SETTINGS_ID);
    if (stored) setSettings({ ...defaultSettings(stored.lang), ...stored });
    else setSettings(s => s); // keep first-run defaults; persisted on first change
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    applyTheme(settings.theme);
    lsSet("gc_theme", settings.theme === "system" ? "" : settings.theme);
    lsSet("gc_theme_pref", settings.theme);
    document.documentElement.lang = settings.lang;
    lsSet("gc_lang", settings.lang);
  }, [settings.theme, settings.lang]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings.theme]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch })); // optimistic, so the UI never waits on the database
    const saved = await repo.put("settings", { ...settings, ...patch, id: SETTINGS_ID });
    setSettings(saved as unknown as Settings);
  }, [settings]);

  const reloadAll = useCallback(async () => {
    await load();
    setDataVersion(v => v + 1);
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({ settings, update, dataVersion, reloadAll, t: (k, v) => translate(settings.lang, k, v) }),
    [settings, update, dataVersion, reloadAll],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
