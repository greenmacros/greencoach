import { expect, test } from "@playwright/test";

// Monday 2026-10-05, mid-morning local time.
const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

test("pick a template, see today's session, skip with undo, move it", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");

  await expect(page.getByText("No program yet")).toBeVisible();
  await page.getByRole("button", { name: "Choose a program" }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();

  await page.getByRole("button", { name: "Today" }).click();
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
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Full Body A" })).toBeVisible(); // Monday's session
  await page.clock.setFixedTime(new Date(2026, 9, 6, 4, 5, 0));
  await page.clock.runFor(31_000); // let the 30 s ticker fire
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible(); // Tuesday
});

test("edit a program: add an exercise, change sets, reorder", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
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
