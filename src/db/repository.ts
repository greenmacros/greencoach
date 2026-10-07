import type { AnyRecord, BackupFile, BaseRecord, ImportMode, TableName } from "./types";

/**
 * The only door UI code uses to reach stored data.
 * A sync backend can later be added by writing another implementation of this interface.
 */
export interface Repository {
  get<T extends BaseRecord = AnyRecord>(table: TableName, id: string): Promise<T | undefined>;
  list<T extends BaseRecord = AnyRecord>(table: TableName): Promise<T[]>;
  /** Insert or replace; fills in id, timestamps and schemaVersion when missing. */
  put<T extends Partial<AnyRecord>>(table: TableName, record: T): Promise<AnyRecord>;
  remove(table: TableName, id: string): Promise<void>;
  exportAll(): Promise<BackupFile>;
  importAll(file: unknown, mode: ImportMode): Promise<{ added: number; updated: number; skipped: number }>;
  deleteAll(): Promise<void>;
  /** Approximate usage, when the browser reports it. */
  storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean } | null>;
}
