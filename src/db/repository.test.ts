import { beforeEach, describe, expect, it } from "vitest";
import { createDexieRepository } from "./dexieRepository";
import { buildBackup, parseBackup } from "./backup";
import type { Repository } from "./repository";
import { dayKey } from "../lib/id";
import { translate } from "../i18n/translate";
import { MESSAGES } from "../i18n/messages";

let repo: Repository;
let n = 0;
beforeEach(() => { repo = createDexieRepository(`test-${n++}`); });

describe("repository", () => {
  it("fills id, timestamps and schemaVersion on put", async () => {
    const r = await repo.put("exercises", { name: "Squat" } as never);
    expect(r.id).toBeTruthy();
    expect(r.schemaVersion).toBe(1);
    expect(await repo.get("exercises", r.id)).toMatchObject({ name: "Squat" });
  });

  it("round-trips export -> replace import", async () => {
    await repo.put("goals", { id: "g1", title: "Bench 100" } as never);
    const file = JSON.parse(JSON.stringify(await repo.exportAll()));
    await repo.deleteAll();
    expect(await repo.list("goals")).toHaveLength(0);
    const res = await repo.importAll(file, "replace");
    expect(res.added).toBe(1);
    expect(await repo.get("goals", "g1")).toMatchObject({ title: "Bench 100" });
  });

  it("merge keeps the newest record", async () => {
    await repo.put("goals", { id: "g1", title: "old" } as never);
    const file = JSON.parse(JSON.stringify(await repo.exportAll()));
    file.tables.goals[0].title = "from-file";
    file.tables.goals[0].updatedAt = "2999-01-01T00:00:00.000Z";
    file.tables.goals.push({ id: "g2", title: "new", createdAt: "x", updatedAt: "2000-01-01T00:00:00.000Z", schemaVersion: 1 });
    const res = await repo.importAll(file, "merge");
    expect(res).toEqual({ added: 1, updated: 1, skipped: 0 });
    expect(await repo.get("goals", "g1")).toMatchObject({ title: "from-file" });
  });

  it("replace removes records that are not in the file", async () => {
    const file = JSON.parse(JSON.stringify(await repo.exportAll()));
    await repo.put("goals", { id: "gx" } as never);
    await repo.importAll(file, "replace");
    expect(await repo.list("goals")).toHaveLength(0);
  });

  it("rejects invalid files without touching data", async () => {
    await repo.put("goals", { id: "g1" } as never);
    await expect(repo.importAll({ app: "Other" }, "replace")).rejects.toThrow("not-a-backup");
    await expect(repo.importAll({ ...buildBackup({}), version: 99 }, "replace")).rejects.toThrow("newer-version");
    await expect(repo.importAll({ ...buildBackup({}), tables: { goals: [{ nope: 1 }] } }, "replace")).rejects.toThrow("bad-table:goals");
    expect(await repo.list("goals")).toHaveLength(1);
  });

  it("deleteAll clears everything", async () => {
    await repo.put("goals", { id: "g1" } as never);
    await repo.deleteAll();
    expect(await repo.list("goals")).toHaveLength(0);
  });

  it("accepts backups made under the earlier name GreenCoach", () => {
    expect(buildBackup({}).app).toBe("GreenCoach");
    expect(() => parseBackup({ app: "GreenCoach", version: 1, tables: {} })).not.toThrow();
  });

  it("parseBackup accepts an empty backup", () => {
    expect(parseBackup(buildBackup({})).counts.goals).toBe(0);
  });
});

describe("helpers", () => {
  it("dayKey honors the day-start hour", () => {
    const d = new Date(2026, 9, 7, 2, 30); // 02:30 local
    expect(dayKey(d, 4)).toBe("2026-10-06");
    expect(dayKey(d, 0)).toBe("2026-10-07");
  });

  it("translate interpolates and falls back", () => {
    expect(translate("ja", "data.used", { used: "3 MB" })).toBe("3 MB 使用中");
    expect(translate("en", "missing.key")).toBe("missing.key");
  });

  it("every message has en and ja", () => {
    for (const [k, v] of Object.entries(MESSAGES)) {
      expect(v.en, k).toBeTruthy();
      expect(v.ja, k).toBeTruthy();
    }
  });
});
