import { describe, expect, it } from "vitest";
import { bandKey, bandLabel, bandsOf, defaultBands, nextBand } from "./bands";
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
});
