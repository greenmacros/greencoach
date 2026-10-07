import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { repo } from "./db";
import { PROFILE_ID, SETTINGS_ID, defaultProfile, defaultSettings } from "./db/defaults";
import type { Profile, Settings } from "./db/types";
import { detectLang, translate, type TFn } from "./i18n/translate";

interface Ctx {
  settings: Settings;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  t: TFn;
  /** Bumps after import/delete so screens reload their data. */
  dataVersion: number;
  /** True once stored settings/profile have been read (avoids a flash of first-run UI). */
  loaded: boolean;
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0f14" : "#f6f7f9");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...defaultSettings(detectLang(lsGet("gc_lang"))),
    theme: (["system", "light", "dark"].includes(lsGet("gc_theme_pref") ?? "") ? lsGet("gc_theme_pref") : "system") as Settings["theme"],
  }));
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [dataVersion, setDataVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const stored = await repo.get<Settings>("settings", SETTINGS_ID);
    if (stored) setSettings({ ...defaultSettings(stored.lang), ...stored });
    else setSettings(s => s); // keep first-run defaults; persisted on first change
    const p = await repo.get<Profile>("profile", PROFILE_ID);
    setProfile(p ? { ...defaultProfile(), ...p } : defaultProfile());
    setLoaded(true);
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

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    setProfile(prev => ({ ...prev, ...patch }));
    const saved = await repo.put("profile", { ...profile, ...patch, id: PROFILE_ID });
    setProfile(saved as unknown as Profile);
  }, [profile]);

  const reloadAll = useCallback(async () => {
    await load();
    setDataVersion(v => v + 1);
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({ settings, update, profile, updateProfile, dataVersion, loaded, reloadAll, t: (k, v) => translate(settings.lang, k, v) }),
    [settings, update, profile, updateProfile, dataVersion, loaded, reloadAll],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
