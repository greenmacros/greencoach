import { expect, test, type Page } from "@playwright/test";

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

async function startFullBody(page: Page) {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
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
