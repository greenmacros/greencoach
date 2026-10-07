import { SCHEMA_VERSION, TABLES, type AnyRecord, type BackupFile } from "./types";

export const BACKUP_VERSION = 1;

const p = (n: number) => String(n).padStart(2, "0");

export function backupFilename(date = new Date()): string {
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const time = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `greencoach-backup-${day}-${time}.json`;
}

export function buildBackup(tables: Record<string, AnyRecord[]>, now = new Date()): BackupFile {
  const counts: Record<string, number> = {};
  for (const t of TABLES) counts[t] = tables[t]?.length ?? 0;
  return { app: "GreenCoach", version: BACKUP_VERSION, exportedAt: now.toISOString(), counts, tables };
}

const isRecord = (r: unknown): r is AnyRecord =>
  typeof r === "object" && r !== null && typeof (r as AnyRecord).id === "string" && typeof (r as AnyRecord).updatedAt === "string";

/** Validates an untrusted parsed JSON value. Throws a short Error('...') if it is not a usable backup. */
export function parseBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || typeof d !== "object" || (d.app !== "GreenCoach" && d.app !== "GreenCoach")) throw new Error("not-a-backup");
  if (typeof d.version !== "number" || d.version > BACKUP_VERSION) throw new Error("newer-version");
  if (!d.tables || typeof d.tables !== "object") throw new Error("not-a-backup");
  const tables: Record<string, AnyRecord[]> = {};
  for (const t of TABLES) {
    const rows = (d.tables as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows) || !rows.every(isRecord)) throw new Error("bad-table:" + t);
    tables[t] = rows;
  }
  return buildBackup(tables, new Date(typeof d.exportedAt === "string" ? d.exportedAt : Date.now()));
}

/** Upgrade records from older schema versions. Add a step per SCHEMA_VERSION bump. */
export function migrateRecord(table: string, record: AnyRecord): AnyRecord {
  void table;
  return record.schemaVersion === SCHEMA_VERSION ? record : { ...record, schemaVersion: SCHEMA_VERSION };
}
