import Dexie, { type Table } from "dexie";
import { buildBackup, migrateRecord, parseBackup } from "./backup";
import type { Repository } from "./repository";
import { newId } from "../lib/id";
import { SCHEMA_VERSION, TABLES, type AnyRecord, type ImportMode, type TableName } from "./types";

class GreenCoachDB extends Dexie {
  profile!: Table<AnyRecord, string>;
  settings!: Table<AnyRecord, string>;
  exercises!: Table<AnyRecord, string>;
  programs!: Table<AnyRecord, string>;
  mesocycles!: Table<AnyRecord, string>;
  workouts!: Table<AnyRecord, string>;
  feedback!: Table<AnyRecord, string>;
  bodyMetrics!: Table<AnyRecord, string>;
  goals!: Table<AnyRecord, string>;
  suggestions!: Table<AnyRecord, string>;
  timerPresets!: Table<AnyRecord, string>;

  constructor(name: string) {
    super(name);
    // Dexie versions: add `this.version(2).stores({...}).upgrade(...)` for each schema change.
    this.version(1).stores({
      profile: "id",
      settings: "id",
      exercises: "id, updatedAt",
      programs: "id",
      mesocycles: "id",
      workouts: "id, dayKey, updatedAt",
      feedback: "id, workoutId, updatedAt",
      bodyMetrics: "id, dayKey",
      goals: "id",
      suggestions: "id, weekKey",
      timerPresets: "id",
    });
  }
}

export function createDexieRepository(dbName = "greencoach"): Repository {
  const db = new GreenCoachDB(dbName);
  const table = (t: TableName) => db.table<AnyRecord, string>(t);

  return {
    get: async (t, id) => (await table(t).get(id)) as never,
    list: async t => (await table(t).toArray()) as never,

    async put(t, record) {
      const now = new Date().toISOString();
      const existing = record.id ? await table(t).get(record.id) : undefined;
      const full = {
        ...record,
        id: record.id ?? newId(),
        createdAt: record.createdAt ?? existing?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: SCHEMA_VERSION,
      } as AnyRecord;
      await table(t).put(full);
      return full;
    },

    remove: (t, id) => table(t).delete(id),

    async exportAll() {
      const tables: Record<string, AnyRecord[]> = {};
      for (const t of TABLES) tables[t] = await table(t).toArray();
      return buildBackup(tables);
    },

    async importAll(file: unknown, mode: ImportMode) {
      const backup = parseBackup(file); // validate fully before touching any data
      let added = 0, updated = 0, skipped = 0;
      await db.transaction("rw", TABLES.map(table), async () => {
        for (const t of TABLES) {
          if (mode === "replace") await table(t).clear();
          for (const raw of backup.tables[t]) {
            const rec = migrateRecord(t, raw);
            const current = mode === "merge" ? await table(t).get(rec.id) : undefined;
            if (!current) { await table(t).put(rec); added++; }
            else if (current.updatedAt < rec.updatedAt) { await table(t).put(rec); updated++; }
            else skipped++;
          }
        }
      });
      return { added, updated, skipped };
    },

    async deleteAll() {
      await db.transaction("rw", TABLES.map(table), async () => {
        for (const t of TABLES) await table(t).clear();
      });
    },

    async storageEstimate() {
      if (!navigator.storage?.estimate) return null;
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;
      return { usage, quota, persisted };
    },
  };
}
