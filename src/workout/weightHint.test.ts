import { beforeAll, describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import type { Exercise } from "../library/types";
import { weightHintKey, weightKind } from "./weightHint";

let all: Exercise[];
beforeAll(async () => { all = await loadBundled(); });
const k = (id: string) => weightHintKey(all.find(e => e.id === id));

describe("what the weight column means", () => {
  it("depends on the equipment", () => {
    expect(k("Barbell_Squat")).toBe("wk.wt.bar");
    expect(k("Dumbbell_Bench_Press")).toBe("wk.wt.db");
    expect(k("Leg_Press")).toBe("wk.wt.plates");
    expect(k("Triceps_Pushdown")).toBe("wk.wt.stack");
    expect(k("Smith_Machine_Bench_Press")).toBe("wk.wt.smith");
    expect(k("Pullups")).toBe("wk.wt.added");
    expect(k("x-band-row")).toBeNull();
  });

  it("agrees with the column label: only add-weight exercises say 'only what you add'", () => {
    for (const ex of all) {
      const hint = weightHintKey(ex);
      if (hint === "wk.wt.added") expect(weightKind(ex)).toBe("addWeight");
      if (weightKind(ex) === "addWeight") expect(hint).toBe("wk.wt.added");
    }
  });
});
