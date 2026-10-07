import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import index from "../data/library/index.json";
import en from "../data/library/instructions.en.json";
import { loadBundled } from "./data";
import { emptyFilters, equipmentFor, normalize, searchExercises, substitutes } from "./search";
import { EQUIPMENT, MUSCLES, PATTERNS, type Exercise } from "./types";

const opts = { lang: "en" as const };
const find = (all: Exercise[], name: string) => all.find(e => e.name.en === name)!;

describe("bundled library", () => {
  it("has 800+ exercises with unique ids", async () => {
    const all = await loadBundled();
    expect(all.length).toBeGreaterThanOrEqual(800);
    expect(new Set(all.map(e => e.id)).size).toBe(all.length);
  });

  it("every exercise is fully described and uses known taxonomy values", async () => {
    for (const e of await loadBundled()) {
      expect(e.name.en, e.id).toBeTruthy();
      expect(e.name.ja, e.id).toBeTruthy();
      expect(e.primary.length, e.id).toBeGreaterThan(0);
      expect(e.primary.every(m => MUSCLES.includes(m)), e.id).toBe(true);
      expect(e.secondary.every(m => MUSCLES.includes(m)), e.id).toBe(true);
      expect(e.equipment.length, e.id).toBeGreaterThan(0);
      expect(e.equipment.every(q => EQUIPMENT.includes(q)), e.id).toBe(true);
      expect(PATTERNS.includes(e.pattern), e.id).toBe(true);
      expect(e.fatigue).toBeGreaterThanOrEqual(1);
      expect(e.fatigue).toBeLessThanOrEqual(5);
    }
  });

  it("has Japanese names that differ from English (translated) for the dataset", () => {
    const untranslated = (index as { id: string; n: string; j: string }[]).filter(r => r.n === r.j && !/^[A-Za-z0-9 ]+$/.test(r.n) === false && /[a-z]{4}/i.test(r.j));
    expect(untranslated.map(r => r.n)).toEqual([]);
  });

  it("every exercise has English instructions", () => {
    const missing = (index as { id: string }[]).filter(r => !(en as Record<string, string[]>)[r.id]?.length).map(r => r.id);
    expect(missing).toEqual([]);
  });

  it("bundled image frames exist on disk", () => {
    const missing: string[] = [];
    for (const r of index as { id: string; img: number }[])
      for (let f = 0; f < r.img; f++) if (!existsSync(`public/ex/${r.id}-${f}.webp`)) missing.push(`${r.id}-${f}`);
    expect(missing).toEqual([]);
  });

  it("covers every equipment filter and the Smith machine / bands / TRX requirements", async () => {
    const all = await loadBundled();
    for (const q of EQUIPMENT) expect(all.some(e => e.equipment.includes(q)), q).toBe(true);
  });
});

describe("search", () => {
  it("matches English names, ignoring case", async () => {
    const all = await loadBundled();
    const r = searchExercises(all, { ...emptyFilters, query: "BENCH PRESS" }, opts);
    expect(r.length).toBeGreaterThan(5);
    expect(r[0].name.en.toLowerCase()).toContain("bench press");
  });

  it("matches Japanese names, and katakana/hiragana interchangeably", async () => {
    const all = await loadBundled();
    const kata = searchExercises(all, { ...emptyFilters, query: "ベンチプレス" }, { lang: "ja" });
    const hira = searchExercises(all, { ...emptyFilters, query: "べんちぷれす" }, { lang: "ja" });
    expect(kata.length).toBeGreaterThan(5);
    expect(hira.map(e => e.id)).toEqual(kata.map(e => e.id));
    expect(searchExercises(all, { ...emptyFilters, query: "ラットプルダウン" }, { lang: "ja" }).length).toBeGreaterThan(2);
    expect(searchExercises(all, { ...emptyFilters, query: "レッグプレス" }, { lang: "ja" }).some(e => e.name.en === "Leg Press")).toBe(true);
  });

  it("tolerates typos", async () => {
    const all = await loadBundled();
    expect(searchExercises(all, { ...emptyFilters, query: "squta" }, opts).length).toBeGreaterThan(5);
    expect(searchExercises(all, { ...emptyFilters, query: "deadlfit" }, opts).some(e => e.name.en === "Barbell Deadlift")).toBe(true);
  });

  it("returns nothing for gibberish", async () => {
    expect(searchExercises(await loadBundled(), { ...emptyFilters, query: "qzxwv" }, opts)).toEqual([]);
  });

  it("filters by muscle, equipment and pattern", async () => {
    const all = await loadBundled();
    const chestSmith = searchExercises(all, { ...emptyFilters, muscles: ["chest"], equipment: ["smith"] }, opts);
    expect(chestSmith.length).toBeGreaterThan(0);
    expect(chestSmith.every(e => e.primary.includes("chest") && e.equipment.includes("smith"))).toBe(true);
    const rows = searchExercises(all, { ...emptyFilters, patterns: ["h-pull"] }, opts);
    expect(rows.every(e => e.pattern === "h-pull")).toBe(true);
  });

  it("hides stretches and cardio unless asked", async () => {
    const all = await loadBundled();
    expect(searchExercises(all, emptyFilters, opts).some(e => e.category === "stretching")).toBe(false);
    expect(searchExercises(all, { ...emptyFilters, includeNonStrength: true }, opts).some(e => e.category === "stretching")).toBe(true);
  });

  it("restricts to favorites and to available equipment", async () => {
    const all = await loadBundled();
    const squat = find(all, "Barbell Squat");
    const fav = searchExercises(all, { ...emptyFilters, favoritesOnly: true }, { ...opts, favorites: new Set([squat.id]) });
    expect(fav.map(e => e.id)).toEqual([squat.id]);
    const home = searchExercises(all, emptyFilters, { ...opts, available: equipmentFor("home") });
    expect(home.every(e => e.equipment.every(q => ["bodyweight", "other"].includes(q)))).toBe(true);
  });

  it("puts recently used exercises first when sorting ties", async () => {
    const all = await loadBundled();
    const target = find(all, "Zottman Curl");
    const r = searchExercises(all, { ...emptyFilters, muscles: ["biceps"] }, { ...opts, recent: new Map([[target.id, "2026-10-01T00:00:00Z"]]) });
    expect(r[0].id).toBe(target.id);
  });

  it("normalize folds width and kana", () => {
    expect(normalize("ＢＥＮＣＨ  Press!")).toBe("bench press");
    expect(normalize("カール")).toBe("かーる");
  });
});

describe("substitutes", () => {
  it("suggests same muscle + pattern within the user's equipment", async () => {
    const all = await loadBundled();
    const bench = find(all, "Barbell Bench Press - Medium Grip");
    const subs = substitutes(all, bench, equipmentFor("dumbbells"));
    expect(subs.length).toBeGreaterThan(0);
    for (const s of subs) {
      expect(s.primary[0]).toBe(bench.primary[0]);
      expect(s.pattern).toBe(bench.pattern);
      expect(s.equipment.every(q => equipmentFor("dumbbells")!.has(q))).toBe(true);
      expect(s.id).not.toBe(bench.id);
    }
  });

  it("returns nothing impossible for bands-only users", async () => {
    const all = await loadBundled();
    const deadlift = find(all, "Barbell Deadlift");
    const subs = substitutes(all, deadlift, equipmentFor("bands"));
    expect(subs.every(s => s.equipment.every(q => ["bodyweight", "bands", "other"].includes(q)))).toBe(true);
  });
});
