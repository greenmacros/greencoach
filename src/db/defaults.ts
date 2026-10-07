import { SCHEMA_VERSION, type Lang, type Settings } from "./types";

export const SETTINGS_ID = "settings";

export function defaultSettings(lang: Lang): Settings {
  const now = new Date().toISOString();
  return {
    id: SETTINGS_ID,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    lang,
    theme: "system",
    weightUnit: "kg",
    lengthUnit: "cm",
    dayStartHour: 4,
    region: "JP",
    backupReminderDays: 14,
    lastBackupAt: null,
    keepAwake: false,
    restSound: true,
    restVibrate: true,
    restNotify: false,
    onboarded: false,
  };
}
