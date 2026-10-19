import { describe, expect, it } from "vitest";
import { dumbbellRack, nearestOnRack, stepOnRack } from "./dumbbells";

describe("dumbbell rack", () => {
  it("mixed: 1 kg to 10 kg, then 2 kg, capped at the heaviest", () => {
    const r = dumbbellRack("mixed", 20);
    expect(r).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]);
  });
  it("an odd heaviest dumbbell is still on the rack", () => {
    expect(dumbbellRack(2, 25).slice(-2)).toEqual([24, 25]);
  });
  it("nearest and stepping never leave the rack", () => {
    const r = dumbbellRack(2, 30);
    expect(nearestOnRack(r, 25)).toBe(24);
    expect(nearestOnRack(r, 21.6)).toBe(22);
    expect(stepOnRack(r, 24, 1)).toBe(26);
    expect(stepOnRack(r, 30, 1)).toBe(30);
    expect(stepOnRack(r, 2, -1)).toBe(2);
  });
});
