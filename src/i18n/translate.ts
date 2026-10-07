import { MESSAGES, type MessageKey } from "./messages";
import type { Lang } from "../db/types";

export const LANGS: Lang[] = ["en", "ja"];

export function detectLang(stored?: string | null): Lang {
  if (stored === "en" || stored === "ja") return stored;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export type Vars = Record<string, string | number>;

/** translate("ja", "data.used", { used: "3 MB" }). Falls back to English, then to the key. */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const entry = (MESSAGES as Record<string, { en: string; ja: string }>)[key];
  let text = entry?.[lang] ?? entry?.en ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return text;
}

export type TFn = (key: MessageKey | (string & {}), vars?: Vars) => string;
