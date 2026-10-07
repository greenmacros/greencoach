import { describe, expect, it } from "vitest";
import { loadBundled } from "../library/data";
import {
  addDays, daysBetween, estimateMinutes, mesoPosition, movePatch, resolveDay, skipPatch, trainingDayKey, trainingDayNumber, unskipPatch, weekDays, weekdayIndex, weekStart,
} from "./schedule";
import { TEMPLATES, exerciseIdsInTemplates, instantiateTemplate, recommendTemplate } from "./templates";
import type { DayOverride, Program } from "./types";

const mk = (over: Partial<Program> = {}): Program => ({
  id: "prog:t", createdAt: "", updatedAt: "", schemaVersion: 1, name: "t", active: true, templateId: null,
  sessions: [
    { id: "push", name: "Push", exercises: [] },
    { id: "pull", name: "Pull", exercises: [] },
  ],
  week: ["push", null, "pull", null, null, null, null],
  accumulationWeeks: 5,
  mesoStartDayKey: "2026-10-05", // a Monday
  ...over,
});
const ovr = (dayKey: string, sessionId: string | null, skipped = false): DayOverride => ({ id: "ovr:" + dayKey, createdAt: "", updatedAt: "", schemaVersion: 1, dayKey, sessionId, skipped });
const map = (...o: DayOverride[]) => new Map(o.map(x => [x.dayKey, x]));

describe("day keys", () => {
  it("counts 02:30 as the previous day when the day starts at 04:00", () => {
    expect(trainingDayKey(new Date(2026, 9, 7, 2, 30), 4)).toBe("2026-10-06");
    expect(trainingDayKey(new Date(2026, 9, 7, 3, 59), 4)).toBe("2026-10-06");
    expect(trainingDayKey(new Date(2026, 9, 7, 4, 0), 4)).toBe("2026-10-07");
    expect(trainingDayKey(new Date(2026, 9, 7, 2, 30), 0)).toBe("2026-10-07");
  });

  it("crosses month and year boundaries", () => {
    expect(trainingDayKey(new Date(2027, 0, 1, 1, 0), 4)).toBe("2026-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("survives DST changes", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("indexes weekdays from Monday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-11")).toBe(6); // Sunday
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(weekDays("2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });
});

describe("resolveDay", () => {
  const p = mk();
  it("follows the weekly template", () => {
    expect(resolveDay(p, map(), "2026-10-05")).toMatchObject({ sessionId: "push", status: "planned" });
    expect(resolveDay(p, map(), "2026-10-06")).toMatchObject({ sessionId: null, status: "rest" });
    expect(resolveDay(p, map(), "2026-10-14")).toMatchObject({ sessionId: "pull", status: "planned" }); // next week
  });

  it("marks completed days done", () => {
    expect(resolveDay(p, map(), "2026-10-05", new Set(["2026-10-05"])).status).toBe("done");
  });

  it("honors overrides and skips", () => {
    expect(resolveDay(p, map(ovr("2026-10-06", "pull")), "2026-10-06")).toMatchObject({ sessionId: "pull", status: "planned", overridden: true });
    expect(resolveDay(p, map(ovr("2026-10-05", "push", true)), "2026-10-05")).toMatchObject({ sessionId: "push", status: "skipped" });
    expect(resolveDay(p, map(ovr("2026-10-05", null)), "2026-10-05").status).toBe("rest");
  });

  it("treats an override pointing at a deleted session as rest", () => {
    expect(resolveDay(p, map(ovr("2026-10-06", "gone")), "2026-10-06").status).toBe("rest");
  });
});

describe("skip / move / swap", () => {
  const p = mk();
  const day = (k: string, o = map()) => resolveDay(p, o, k);

  it("skips a planned day and undoes it by clearing the override", () => {
    const [skip] = skipPatch(day("2026-10-05"));
    expect(skip).toEqual({ dayKey: "2026-10-05", sessionId: "push", skipped: true });
    const o = map(ovr("2026-10-05", "push", true));
    expect(unskipPatch(p, day("2026-10-05", o))).toEqual([{ dayKey: "2026-10-05", clear: true }]);
  });

  it("cannot skip a rest day", () => {
    expect(skipPatch(day("2026-10-06"))).toEqual([]);
  });

  it("moves a session onto a rest day: source becomes rest", () => {
    const patches = movePatch(p, day("2026-10-05"), day("2026-10-06"));
    expect(patches).toEqual([
      { dayKey: "2026-10-06", sessionId: "push", skipped: false },
      { dayKey: "2026-10-05", sessionId: null, skipped: false },
    ]);
    const o = map(...patches.map(x => ovr(x.dayKey, "sessionId" in x ? x.sessionId : null)));
    expect(resolveDay(p, o, "2026-10-05").status).toBe("rest");
    expect(resolveDay(p, o, "2026-10-06").sessionId).toBe("push");
  });

  it("swaps when the target already has a session, so none is lost", () => {
    const patches = movePatch(p, day("2026-10-05"), day("2026-10-07"));
    const o = map(...patches.filter(x => "sessionId" in x).map(x => ovr(x.dayKey, (x as { sessionId: string | null }).sessionId)));
    expect(resolveDay(p, o, "2026-10-05").sessionId).toBe("pull");
    expect(resolveDay(p, o, "2026-10-07").sessionId).toBe("push");
  });

  it("moving back to the original day clears overrides", () => {
    const o = map(ovr("2026-10-06", "push"), ovr("2026-10-05", null));
    const patches = movePatch(p, resolveDay(p, o, "2026-10-06"), resolveDay(p, o, "2026-10-05"));
    expect(patches).toEqual([{ dayKey: "2026-10-05", clear: true }, { dayKey: "2026-10-06", clear: true }]);
  });

  it("ignores no-op moves", () => {
    expect(movePatch(p, day("2026-10-05"), day("2026-10-05"))).toEqual([]);
    expect(movePatch(p, day("2026-10-06"), day("2026-10-05"))).toEqual([]);
  });
});

describe("mesocycle position", () => {
  const p = mk({ accumulationWeeks: 5 });
  it("is week 1 of 6 in the first week", () => {
    expect(mesoPosition(p, "2026-10-07")).toMatchObject({ week: 1, total: 6, isDeload: false, cycle: 1, started: true });
  });
  it("reaches the deload in week 6, then restarts automatically", () => {
    expect(mesoPosition(p, "2026-11-09")).toMatchObject({ week: 6, isDeload: true });
    expect(mesoPosition(p, "2026-11-16")).toMatchObject({ week: 1, cycle: 2, isDeload: false });
  });
  it("treats dates before the start as week 1 (not started)", () => {
    expect(mesoPosition(p, "2026-09-01")).toMatchObject({ week: 1, started: false });
  });
  it("clamps configured length to 3-8 weeks", () => {
    expect(mesoPosition(mk({ accumulationWeeks: 1 }), "2026-10-05").total).toBe(4);
    expect(mesoPosition(mk({ accumulationWeeks: 20 }), "2026-10-05").total).toBe(9);
  });
  it("is Sunday-safe: Sunday belongs to the same week as its Monday", () => {
    expect(mesoPosition(p, "2026-10-11").week).toBe(1);
    expect(mesoPosition(p, "2026-10-12").week).toBe(2);
  });
});

describe("trainingDayNumber", () => {
  it("numbers training days within the week from the template", () => {
    const p = mk({ week: ["push", null, "pull", null, "push", null, null] });
    expect(trainingDayNumber(p, "2026-10-05")).toBe(1); // Mon
    expect(trainingDayNumber(p, "2026-10-07")).toBe(2); // Wed
    expect(trainingDayNumber(p, "2026-10-09")).toBe(3); // Fri
    expect(trainingDayNumber(p, "2026-10-06")).toBe(1); // rest day after day 1 -> never below 1
  });
});

describe("templates", () => {
  it("every exercise referenced by a template exists in the library", async () => {
    const ids = new Set((await loadBundled()).map(e => e.id));
    expect(exerciseIdsInTemplates().filter(id => !ids.has(id))).toEqual([]);
  });

  it("every template week matches its declared days and points at real sessions", () => {
    for (const t of TEMPLATES) {
      expect(t.week).toHaveLength(7);
      expect(t.week.filter(x => x !== null)).toHaveLength(t.daysPerWeek);
      for (const i of t.week) if (i !== null) expect(t.sessions[i], t.id).toBeDefined();
    }
  });

  it("includes the required templates", () => {
    expect(TEMPLATES.map(t => t.id)).toEqual(["full-body-3", "upper-lower-4", "ppl-6", "bro-5", "home-4", "example-4", "blank"]);
  });

  it("carries slot notes into the program in the user's language", () => {
    const spec = TEMPLATES.find(t => t.id === "example-4")!;
    const ja = instantiateTemplate(spec, "ja", "2026-10-07");
    expect(ja.week.filter(Boolean)).toHaveLength(4);
    expect(ja.sessions[0].exercises[0].notes).toContain("ウォームアップ");
    expect(instantiateTemplate(spec, "en", "2026-10-07").sessions[1].exercises[0].notes).toContain("1-2 RIR");
  });

  it("instantiates an editable, localized copy anchored to this week", () => {
    const spec = TEMPLATES.find(t => t.id === "upper-lower-4")!;
    const ja = instantiateTemplate(spec, "ja", "2026-10-07");
    expect(ja.name).toBe("上半身／下半身 週4回");
    expect(ja.mesoStartDayKey).toBe("2026-10-05");
    expect(ja.week.filter(Boolean)).toHaveLength(4);
    const ids = ja.sessions.flatMap(s => s.exercises.map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length); // fresh ids, not shared with the template
    expect(instantiateTemplate(spec, "en", "2026-10-07").sessions[0].name).toBe("Upper A");
  });

  it("recommends a template from equipment, days and experience", () => {
    const r = (equipment: "home" | "bands" | "dumbbells" | "gym", daysPerWeek: number, experience: "beginner" | "intermediate" | "advanced" = "intermediate") => recommendTemplate({ equipment, daysPerWeek, experience });
    expect(r("dumbbells", 5)).toBe("home-4");
    expect(r("home", 3)).toBe("home-4");
    expect(r("gym", 2)).toBe("full-body-3");
    expect(r("gym", 3)).toBe("full-body-3");
    expect(r("gym", 4)).toBe("upper-lower-4");
    expect(r("gym", 6, "beginner")).toBe("upper-lower-4");
    expect(r("gym", 5)).toBe("bro-5");
    expect(r("gym", 6)).toBe("ppl-6");
  });

  it("blank has no sessions", () => {
    const b = instantiateTemplate(TEMPLATES.find(t => t.id === "blank")!, "en", "2026-10-07");
    expect(b.sessions).toEqual([]);
    expect(b.week.every(x => x === null)).toBe(true);
  });

  it("estimates plausible session durations", () => {
    const p = instantiateTemplate(TEMPLATES[0], "en", "2026-10-07");
    for (const s of p.sessions) expect(estimateMinutes(s)).toBeGreaterThanOrEqual(30), expect(estimateMinutes(s)).toBeLessThanOrEqual(120);
  });
});
