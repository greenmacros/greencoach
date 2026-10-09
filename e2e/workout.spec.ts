import { skipOnboarding } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

async function startFullBody(page: Page) {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await page.getByRole("button", { name: "Start workout" }).click();
}

test("log a set, rest timer on the same page, draft survives reload, finish and save", async ({ page }) => {
  await startFullBody(page);
  await expect(page.getByRole("heading", { name: "Full Body A" })).toBeVisible();

  const timer = page.getByRole("timer");
  await expect(page.getByRole("region", { name: "Rest timer" })).toBeVisible(); // docked on the workout page

  // Done is disabled until reps are entered
  const done1 = page.getByRole("button", { name: "Mark set done: Set 1" }).first();
  await expect(done1).toHaveAttribute("aria-disabled", "true");
  // stepper strip under the focused field: barbell steps by 2.5 kg
  await page.getByRole("textbox", { name: /^Set 1 Weight/ }).first().fill("100");
  await page.getByRole("button", { name: "+ Set 1 weight" }).click();
  await expect(page.getByRole("textbox", { name: /^Set 1 Weight/ }).first()).toHaveValue("102.5");
  await page.getByRole("textbox", { name: /^Set 1 Weight/ }).first().fill("100");
  await page.getByRole("textbox", { name: "Set 1 Reps" }).first().fill("8");
  await done1.click();
  await expect(timer).toHaveText(/^(3:00|2:5\d)$/); // squat: 3:00 rest

  await page.screenshot({ path: "test-results/workout.png" });
  await page.getByRole("button", { name: "Add 15 seconds" }).click();
  await expect(timer).toHaveText(/^3:1\d$|^3:0\d$/);
  await page.getByRole("region", { name: "Rest timer" }).getByRole("button", { name: "1:30", exact: true }).click();
  await expect(timer).toHaveText(/^(1:30|1:29)$/);

  // pause freezes it
  await page.getByRole("button", { name: "Pause" }).click();
  const frozen = await timer.textContent();
  await page.clock.runFor(5000);
  await expect(timer).toHaveText(frozen!);
  await page.getByRole("button", { name: "Resume" }).first().click();

  // custom time is saved; long-press removes it
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByLabel("Rest time (e.g. 1:45 or 105)").fill("1:45");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const saved = page.getByRole("button", { name: /^1:45 \(/ });
  await expect(saved).toBeVisible();
  const box = (await saved.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  await expect(saved).toHaveCount(0);

  // autosave: reload and resume the draft
  await page.clock.runFor(500);
  await page.reload();
  await expect(page.getByText("Workout in progress")).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark set not done: Set 1" }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Set 1 Weight/ }).first()).toHaveValue("100");

  // finish -> summary -> save -> Today shows Done
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Finish workout" });
  await expect(dlg.getByText("Working sets")).toBeVisible();
  await expect(dlg.getByText("800 kg")).toBeVisible();
  await dlg.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByText("Done").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workout" })).toHaveCount(0);
});

test("next session shows last time's values; empty workout can be discarded", async ({ page }) => {
  await startFullBody(page);
  await page.getByRole("textbox", { name: /^Set 1 Weight/ }).first().fill("102.5");
  await page.getByRole("textbox", { name: "Set 1 Reps" }).first().fill("6");
  await page.getByRole("button", { name: "Mark set done: Set 1" }).first().click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Save workout" }).click();

  // a quick workout on the rest of the week: start from a rest day... use Tuesday
  await page.getByRole("button", { name: /Tuesday/ }).click();
  await page.getByRole("button", { name: "Quick workout" }).click();
  await expect(page.getByText("Add your first exercise to begin.")).toBeVisible();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("dialog").getByRole("searchbox").fill("barbell squat");
  await page.getByRole("dialog").getByRole("listitem").first().click();
  await page.getByRole("dialog").getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Last: 102.5×6").first()).toBeVisible(); // from Monday's saved session
  await expect(page.getByRole("textbox", { name: /^Set 1 Weight/ })).toHaveValue("102.5"); // prefilled
  await page.getByRole("button", { name: "Remove exercise" }).count();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
});

test("tap an exercise picture to see it larger with its target muscles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFullBody(page);
  await page.getByRole("button", { name: /^Show larger with target muscles: / }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Target", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Quads")).toBeVisible();
  await page.screenshot({ path: "test-results/preview.png" });
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("textbox", { name: "Set 1 Reps" }).first().fill("8");
  await page.getByRole("button", { name: "Mark set done: Set 1" }).first().click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.screenshot({ path: "test-results/timer.png" });
});

test("text typed through an IME composition is kept intact", async ({ page }) => {
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  const name = page.getByRole("textbox", { name: "Program name" }).first();
  await name.fill("");
  // Simulate kana composition: intermediate values arrive while composing, then the final text.
  await name.dispatchEvent("compositionstart");
  for (const v of ["ぷ", "ぷろ", "ぷろぐ", "ぷろぐら", "ぷろぐらむ"]) await name.fill(v);
  await name.fill("プログラム");
  await name.dispatchEvent("compositionend");
  await page.waitForTimeout(300);
  await expect(name).toHaveValue("プログラム");
  await name.blur();
  await page.reload();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Program name" }).first()).toHaveValue("プログラム");

  // App version is shown in Settings
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("app-version")).toHaveText(/^Version \d+\.\d+\.\d+ · built .+ · \w+$/);
});

test("Add set works right after typing reps or finishing a set (the stepper strip does not swallow the tap)", async ({ page }) => {
  await startFullBody(page);
  const sq = page.getByRole("article", { name: "Barbell Squat" });
  await sq.getByRole("textbox", { name: "Set 1 Reps" }).fill("8");
  await sq.getByRole("button", { name: /Add set/ }).click();
  await expect(sq.getByRole("textbox", { name: "Set 4 Reps" })).toBeVisible();
  await sq.getByRole("textbox", { name: "Set 2 Reps" }).fill("8");
  await sq.getByRole("button", { name: "Mark set done: Set 2" }).click();
  await sq.getByRole("button", { name: /Add set/ }).click();
  await expect(sq.getByRole("textbox", { name: "Set 5 Reps" })).toBeVisible();
});

test("optional exercises, skipping with a reason, and no rest timer after an exercise's last set", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date(2026, 9, 7, 10, 0, 0) }); // Wednesday: Chest & Arms
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Example" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await expect(page.getByText(/Dips - Triceps Version · Optional/)).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();

  // the last set of an exercise does not start the rest timer
  const bench = page.getByRole("article", { name: "Smith Machine Bench Press" });
  for (const n of [1, 2, 3]) {
    await bench.getByRole("textbox", { name: `Set ${n} Reps` }).fill("8");
    await bench.getByRole("button", { name: `Mark set done: Set ${n}` }).click();
    if (n < 3) await expect(page.getByRole("timer")).toBeVisible();
    else {
      await page.getByRole("dialog", { name: "Feedback" }).getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: "Skip", exact: true }).click(); // stop the timer from set 2
      await expect(page.getByRole("timer")).toHaveCount(0);
    }
  }

  // optional badge and skipping a whole exercise with a reason
  const dips = page.getByRole("article", { name: "Dips - Triceps Version" });
  await expect(dips.getByText("Optional", { exact: true })).toBeVisible();
  await dips.getByRole("button", { name: /^Edit: / }).click();
  await dips.getByRole("button", { name: "Skip exercise" }).click();
  const sheet = page.getByRole("dialog", { name: "Skip Dips - Triceps Version" });
  await sheet.getByRole("button", { name: "Short on time" }).click();
  await page.screenshot({ path: "test-results/skip-sheet.png" });
  await sheet.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(dips.getByText("Skipped: Short on time")).toBeVisible();
  await page.screenshot({ path: "test-results/skipped.png" });
  await dips.getByRole("button", { name: "Do it after all" }).click();
  await expect(dips.getByRole("textbox", { name: "Set 1 Reps" })).toBeVisible();

  // skipping a single set asks why as well
  const curl = page.getByRole("article", { name: "Machine Bicep Curl" });
  await curl.getByRole("button", { name: /^Set 2: Working/ }).click();
  await page.getByRole("dialog", { name: "Set 2", exact: true }).getByRole("button", { name: "Skip set" }).click();
  await page.getByRole("dialog", { name: "Skip set 2" }).getByRole("button", { name: "Too tired" }).click();
  await page.getByRole("dialog", { name: "Skip set 2" }).getByRole("button", { name: "Skip", exact: true }).click();
  await expect(curl.getByText("Skipped · Too tired")).toBeVisible();
});
