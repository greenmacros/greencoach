import { expect, test } from "@playwright/test";

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

test("PR toast, soreness + exercise + session feedback, history and exercise history", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();

  // Monday: one squat set at 100 kg x 5
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("textbox", { name: /^Set 1 Weight/ }).first().fill("100");
  await page.getByRole("textbox", { name: "Set 1 Reps" }).first().fill("5");
  await page.getByRole("button", { name: "Mark set done: Set 1" }).first().click();
  await expect(page.getByText(/New PR!/)).toHaveCount(0); // first time is a baseline
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Save workout" }).click();

  // Tuesday quick workout: squat 105 x 5
  await page.getByRole("button", { name: /Tuesday/ }).click();
  await page.getByRole("button", { name: "Quick workout" }).click();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("dialog").getByRole("searchbox").fill("barbell squat");
  await page.getByRole("dialog").getByRole("listitem").first().click();
  await page.getByRole("dialog").getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();

  // soreness from Monday's squats
  const sore = page.getByRole("region", { name: "Soreness from last time" });
  await expect(sore).toBeVisible();
  await sore.getByRole("group", { name: /Quads/ }).getByRole("button", { name: "Just in time" }).click();
  await expect(sore.getByText("Thanks, noted.")).toBeVisible();

  await page.getByRole("button", { name: "Remove set: Set 3" }).click();
  await page.getByRole("button", { name: "Remove set: Set 2" }).click();
  await page.getByRole("textbox", { name: /^Set 1 Weight/ }).fill("105");
  await page.getByRole("textbox", { name: "Set 1 Reps" }).fill("5");
  await page.getByRole("button", { name: "Mark set done: Set 1" }).click();
  await expect(page.getByText(/New PR! Barbell Squat/)).toBeVisible();
  await expect(page.getByRole("img", { name: "Personal record" })).toBeVisible();

  // exercise feedback appears because every set is done
  const fb = page.getByRole("group", { name: /How did Barbell Squat feel/ });
  await expect(fb).toBeVisible();
  await fb.getByRole("button", { name: "Hard" }).click();
  await fb.getByRole("button", { name: "Good", exact: true }).first().click();
  await expect(fb.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");

  // finish: records list + session feel
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Finish workout" });
  await expect(dlg.getByText("New records")).toBeVisible();
  await expect(dlg.getByText(/Heaviest weight 105 kg/)).toBeVisible();
  await dlg.getByRole("button", { name: "Great" }).click();
  await dlg.getByRole("button", { name: "Save workout" }).click();

  // history
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("button", { name: /Quick workout/ })).toBeVisible();
  await page.getByRole("button", { name: /Quick workout/ }).click();
  const detail = page.getByRole("dialog", { name: "Workout details" });
  await expect(detail.getByText("105 kg × 5")).toBeVisible();
  await expect(detail.getByText(/Difficulty: Hard/)).toBeVisible();
  await expect(detail.getByText(/Session: Great/)).toBeVisible();
  await detail.getByRole("button", { name: "Barbell Squat" }).click();
  const exh = page.getByRole("dialog", { name: /Exercise history: Barbell Squat/ });
  await expect(exh.getByText(/2 sessions/)).toBeVisible();
  await expect(exh.getByText(/🏆/)).toBeVisible();

  // delete with undo
  await exh.getByRole("button", { name: "Close" }).click();
  await detail.getByRole("button", { name: "Delete workout" }).click();
  await detail.getByRole("button", { name: "Delete workout" }).click();
  await expect(page.getByText("Workout deleted.")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /Quick workout/ })).toBeVisible();
});
