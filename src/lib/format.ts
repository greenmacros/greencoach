import type { Lang, WeightUnit } from "../db/types";

export const KG_PER_LB = 0.45359237;

export const toDisplayWeight = (kg: number, unit: WeightUnit) => (unit === "kg" ? kg : kg / KG_PER_LB);
export const fromDisplayWeight = (v: number, unit: WeightUnit) => (unit === "kg" ? v : v * KG_PER_LB);

export function formatBytes(n: number, lang: Lang): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${new Intl.NumberFormat(lang === "ja" ? "ja-JP" : undefined, { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${units[i]}`;
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const daysSince = (iso: string, now = new Date()) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

import { keyToDate } from "../program/schedule";

const locale = (lang: Lang) => (lang === "ja" ? "ja-JP" : undefined);

export const formatDayKey = (key: string, lang: Lang, opts: Intl.DateTimeFormatOptions) => keyToDate(key).toLocaleDateString(locale(lang), opts);
export const weekdayShort = (key: string, lang: Lang) => formatDayKey(key, lang, { weekday: "short" });
export const weekdayLong = (key: string, lang: Lang) => formatDayKey(key, lang, { weekday: "long" });
export const formatDayLong = (key: string, lang: Lang) => formatDayKey(key, lang, { weekday: "long", month: "short", day: "numeric" });

export function formatRest(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
