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
