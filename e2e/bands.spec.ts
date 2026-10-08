import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

test("log a band exercise by band, and manage my bands", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date(2026, 9, 8, 10, 0, 0) }); // Thursday: Home Upper B
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Home dumbbells + bands" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await page.getByRole("button", { name: "Start workout" }).click();

  const row = page.getByRole("article", { name: "Band Row" });
  await expect(row.getByText("Band", { exact: true }).first()).toBeVisible();
  await row.getByRole("button", { name: "Set 1 Band: none" }).click();
  const picker = page.getByRole("dialog", { name: "Set 1 Band" });
  await picker.getByRole("button", { name: /Medium/ }).click();
  await page.screenshot({ path: "test-results/band-picker.png" });
  await picker.getByRole("button", { name: "Done" }).click();
  await expect(row.getByRole("button", { name: "Set 1 Band: Medium" })).toBeVisible();
  await row.getByRole("textbox", { name: "Set 1 Reps" }).fill("12");
  await row.getByRole("button", { name: "Mark set done: Set 1" }).click();
  // the next set added copies the band
  await row.getByRole("button", { name: /Add set/ }).click();
  await expect(row.getByRole("button", { name: "Set 4 Band: Medium" })).toBeVisible();
  await page.screenshot({ path: "test-results/band-workout.png" });
  await page.getByRole("button", { name: "← Back" }).click();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const mine = page.getByRole("heading", { name: "My bands" }).locator("..");
  await mine.getByRole("button", { name: "Medium", exact: true }).click();
  await mine.getByRole("textbox").first().fill("Theraband Blue");
  await mine.getByRole("textbox").first().blur();
  await expect(mine.getByRole("button", { name: "Theraband Blue", exact: true })).toBeVisible();
  await mine.getByRole("button", { name: "Move heavier: Theraband Blue" }).click();
  // kg that contradicts the order shows a warning with a one-tap fix
  await mine.getByRole("button", { name: "Light", exact: true }).click();
  await mine.getByRole("group", { name: "About how many kg (optional)" }).getByRole("textbox").fill("20");
  await mine.getByRole("button", { name: "Heavy", exact: true }).click();
  await mine.getByRole("group", { name: "About how many kg (optional)" }).getByRole("textbox").fill("10");
  await mine.getByRole("group", { name: "About how many kg (optional)" }).getByRole("textbox").blur();
  await expect(page.getByText(/Heavy is lighter than Light/)).toBeVisible();
  await page.screenshot({ path: "test-results/my-bands.png" });
  await page.getByRole("button", { name: "Sort by kg" }).click();
  await expect(page.getByText(/is lighter than/)).toBeHidden();
});
