import { describe, expect, it } from "vitest";
import { canDo, myEquipment, setupFor } from "./equipment";

describe("my equipment", () => {
  it("falls back to the preset of the chosen setup, and always includes bodyweight", () => {
    const gym = myEquipment({ equipment: "gym" });
    expect(gym.has("barbell") && gym.has("cable") && gym.has("bodyweight")).toBe(true);
    const bands = myEquipment({ equipment: "bands" });
    expect([...bands].sort()).toEqual(["bands", "bodyweight", "other"]);
  });

  it("uses exactly the user's list when set", () => {
    const have = myEquipment({ equipment: "gym", myEquipment: ["dumbbell", "bench"] });
    expect(canDo({ equipment: ["dumbbell", "bench"] }, have)).toBe(true);
    expect(canDo({ equipment: ["barbell", "bench"] }, have)).toBe(false);
    expect(canDo({ equipment: ["bodyweight"] }, have)).toBe(true);
  });

  it("derives the coarse setup from the list", () => {
    expect(setupFor(["dumbbell", "bench", "smith"])).toBe("gym");
    expect(setupFor(["dumbbell", "bands"])).toBe("dumbbells");
    expect(setupFor(["bands", "pullup-bar"])).toBe("bands");
    expect(setupFor(["pullup-bar"])).toBe("home");
  });
});
