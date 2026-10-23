import { acceptSafety, dismissTour, skipOnboarding } from "./helpers";
import { expect, test } from "@playwright/test";

// Monday 2026-10-05, mid-morning local time.
const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

test("pick a template, see today's session, skip with undo, move it", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await skipOnboarding(page);

  await expect(page.getByText("No program yet")).toBeVisible();
  await page.getByRole("button", { name: "Choose a program" }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();

  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Full Body A" })).toBeVisible();
  await expect(page.getByText("Week 1 of 6")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();

  // skip + undo
  await page.getByRole("button", { name: "Skip this day" }).click();
  await expect(page.getByText("Skipped").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo skip" })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Skip this day" })).toBeVisible();

  // move to Tuesday (rest day): Monday becomes rest
  await page.getByRole("button", { name: "Move to another day" }).click();
  await page.getByRole("button", { name: "Tue 6", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  await page.getByRole("button", { name: /Tuesday, Full Body A/ }).click();
  await expect(page.getByRole("heading", { name: "Full Body A" })).toBeVisible();
});

test("the training day flips at 04:00, not midnight", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 6, 2, 30, 0) }); // Tuesday 02:30 still counts as Monday
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Full Body A" })).toBeVisible(); // Monday's session
  await page.clock.setFixedTime(new Date(2026, 9, 6, 4, 5, 0));
  await page.clock.runFor(31_000); // let the 30 s ticker fire
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible(); // Tuesday
});

test("edit a program: add an exercise, change sets, reorder", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Blank" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Add session" }).click();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("dialog").getByRole("searchbox").fill("goblet squat");
  await page.getByRole("dialog").getByRole("listitem").first().click();
  await page.getByRole("dialog").getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  const sets = page.getByRole("textbox", { name: /^Sets:/ });
  await expect(sets).toHaveValue("3");
  await page.getByRole("button", { name: /^Increase: Sets/ }).click();
  await expect(sets).toHaveValue("4");
  await page.reload();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("textbox", { name: /^Sets:/ })).toHaveValue("4"); // persisted
});

test("replacing an exercise keeps sets and reps but drops the old target weight", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 5, 10, 0, 0) });
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Example" }).getByRole("button", { name: "Use this template" }).click();
  // give the Smith bench a remembered target weight, as an accepted coach suggestion would
  await page.evaluate(() => new Promise<void>(res => {
    const r = indexedDB.open("greencoach");
    r.onsuccess = () => {
      const tx = r.result.transaction("programs", "readwrite"), st = tx.objectStore("programs");
      const q = st.getAll();
      q.onsuccess = () => {
        const p = q.result.find((x: { active: boolean }) => x.active);
        for (const s of p.sessions) for (const e of s.exercises) if (e.exerciseId === "Smith_Machine_Bench_Press") e.weightKg = 60;
        st.put(p);
      };
      tx.oncomplete = () => { r.result.close(); res(); };
    };
  }));
  await page.reload();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("heading", { name: "Chest & Arms" }).locator("..").locator("..").getByRole("button", { name: "Edit", exact: true }).click();
  const slot = page.getByRole("listitem").filter({ hasText: "Smith Machine Bench Press" });
  await slot.getByRole("button", { name: "Replace" }).click();
  await page.getByRole("searchbox", { name: /Search exercises/ }).fill("barbell bench press medium");
  await page.getByRole("button", { name: /Barbell Bench Press - Medium Grip/ }).first().click();
  await page.getByRole("dialog", { name: "Barbell Bench Press - Medium Grip" }).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Barbell Bench Press - Medium Grip" })).toBeVisible();
  // the old notes are kept but questioned once
  const replaced = page.getByRole("listitem").filter({ hasText: "Barbell Bench Press - Medium Grip" });
  await expect(replaced.getByText("These notes were written for Smith Machine Bench Press. Do they still fit?")).toBeVisible();
  await replaced.getByRole("button", { name: "Clear notes" }).click();
  await expect(replaced.getByRole("textbox", { name: /^Notes/ })).toHaveValue("");
  await page.waitForTimeout(600); // let the program write land before the reload
  // Wednesday's workout: barbell bench, same 3 sets, no 60 kg carried over
  await page.clock.setFixedTime(new Date(2026, 9, 7, 10, 0, 0));
  await page.reload();
  await page.getByRole("button", { name: "Start workout" }).click();
  const bench = page.getByRole("article", { name: "Barbell Bench Press - Medium Grip" });
  await expect(bench.getByRole("textbox", { name: "Set 3 Reps" })).toBeVisible();
  await expect(bench.getByRole("textbox", { name: /^Set 1 Weight/ })).toHaveValue("");
});

test("the plan lists each session's exercises; tapping one opens its card (how-to, history) without leaving the plan", async ({ page }) => {
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: /^Show Barbell Squat:/ }).first().click();
  const card = page.getByRole("dialog", { name: "Barbell Squat" });
  await expect(card).toBeVisible();
  await expect(card.getByText("How to")).toBeVisible();
  // Tapping the photo shows it large, like during a workout; Escape closes only the large view.
  await card.getByRole("button", { name: "Show larger with target muscles" }).click();
  await expect(page.getByRole("dialog", { name: "Barbell Squat" })).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Barbell Squat" })).toHaveCount(1);
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toBeHidden();
  // No sideways scrolling with the list in place (long names are cut, not widening the page).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("first setup: choosing the empty program opens the Program tab to build it", async ({ page }) => {
  await page.goto("/");
  await acceptSafety(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("article", { name: "Blank" }).getByRole("button").click();
  await dismissTour(page);
  await expect(page.getByRole("heading", { name: "Program", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build your program" })).toBeVisible();
  await page.screenshot({ path: "test-results/blank-start.png" });
  await page.getByRole("button", { name: "Add your first session" }).click();
  await expect(page.getByRole("button", { name: "Add exercise" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Build your program" })).toBeHidden();
});
