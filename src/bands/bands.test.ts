import { describe, expect, it } from "vitest";
import { bandKey, bandLabel, bandStrength, bandsOf, defaultBands, nextBand, nextBandRange, nextCombo, orderConflicts, sortByKg, stepUp, type Band } from "./bands";
import { buildExerciseLog, addSet } from "../workout/model";
import type { SetLog } from "../workout/types";

describe("resistance bands", () => {
  const bands = defaultBands("en");

  it("defaults to five levels in the user's language until edited", () => {
    expect(bands.map(b => b.name)).toEqual(["Extra light", "Light", "Medium", "Heavy", "Extra heavy"]);
    expect(defaultBands("ja")[2].name).toBe("ミディアム");
    expect(bandsOf({ lang: "en", bands: [bands[1]] })).toEqual([bands[1]]);
  });

  it("moves one band at a time in the user's order, never past the heaviest", () => {
    expect(nextBand(["band-2"], bands)).toBe("band-3");
    expect(nextBand(["band-5"], bands)).toBeNull();
    expect(nextBand(["band-1", "band-2"], bands)).toBeNull();
    expect(nextBand(["gone"], bands)).toBeNull();
  });

  it("labels combinations lightest first and keys them regardless of order", () => {
    expect(bandLabel(["band-4", "band-1"], bands)).toBe("Extra light + Heavy");
    expect(bandKey(["band-4", "band-1"])).toBe(bandKey(["band-1", "band-4"]));
  });

  it("a new workout and an added set carry the band over", () => {
    const prev: SetLog[] = [{ id: "s", type: "normal", weightKg: null, reps: 12, rir: 2, done: true, doneAt: null, bands: ["band-2"] }];
    const log = buildExerciseLog(null, "x-band-row", prev);
    expect(log.sets.every(s => s.bands?.[0] === "band-2")).toBe(true);
    const fromCoach = buildExerciseLog({ id: "slot", exerciseId: "x-band-row", sets: 2, repMin: 10, repMax: 15, rir: 2, restSec: 90, notes: "", supersetGroup: null, bands: ["band-3"] }, "x-band-row", prev);
    expect(fromCoach.sets.map(s => s.bands)).toEqual([["band-3"], ["band-3"]]);
    expect(addSet(log).sets.at(-1)!.bands).toEqual(["band-2"]);
  });

  it("then raises the rep range in steps, to 30 at most", () => {
    expect(nextBandRange(15)).toEqual({ min: 15, max: 20 });
    expect(nextBandRange(20)).toEqual({ min: 20, max: 30 });
    expect(nextBandRange(12)).toEqual({ min: 10, max: 15 });
    expect(nextBandRange(30)).toBeNull();
  });

  describe("with the kg from the package", () => {
    const mine: Band[] = [
      { id: "l", name: "Light", color: "", kg: 5 }, { id: "m", name: "Medium", color: "", kg: 10 }, { id: "h", name: "Heavy", color: "", kg: 20 },
    ];

    it("adds up combinations, and only when every band has a kg", () => {
      expect(bandStrength(["l", "h"], mine)).toBe(25);
      expect(bandStrength(["l", "x"], mine)).toBeNull();
    });

    it("past the heaviest band, picks the lightest stronger single, pair or trio (fewer bands on a tie)", () => {
      expect(nextCombo(["h"], mine)).toEqual(["l", "h"]);           // 25
      expect(nextCombo(["l", "h"], mine)).toEqual(["m", "h"]);      // 30
      expect(nextCombo(["m", "h"], mine)).toEqual(["l", "m", "h"]); // 35: all three stacked
      expect(nextCombo(["l", "m", "h"], mine)).toBeNull();          // nothing stronger
      expect(stepUp(["m"], mine)).toEqual(["h"]);                   // the order comes first
      expect(stepUp(["h"], mine.map(b => ({ ...b, kg: null })))).toBeNull(); // no kg: no combination advice
    });

    it("flags an order that contradicts the kg and sorts it", () => {
      const wrong = [mine[0], mine[2], mine[1]];
      expect(orderConflicts(wrong).map(([a, b]) => [a.id, b.id])).toEqual([["h", "m"]]);
      expect(sortByKg(wrong).map(b => b.id)).toEqual(["l", "m", "h"]);
      expect(orderConflicts(mine)).toEqual([]);
    });
  });
});
