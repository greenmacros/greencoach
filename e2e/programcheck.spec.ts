import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

test("program check: finds a muscle with too little work, adds a suggested exercise or any other, focus muscles, ignore", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date(2026, 9, 5, 10, 0, 0) });
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Coach", exact: true }).click();

  await page.getByRole("button", { name: /Program check/ }).click();
  const check = page.getByRole("region", { name: "Program check" }).or(page.locator("section").filter({ has: page.getByRole("button", { name: /Program check/ }) }));
  const calves = check.locator(".card").filter({ hasText: /^Lats: about/ });
  await expect(calves).toBeVisible();
  await page.screenshot({ path: "test-results/program-check.png" });

  // "see all options" opens the whole library, filtered to the muscle
  await calves.getByRole("button", { name: "See all options" }).click();
  const picker = page.getByRole("dialog", { name: "Choose an exercise" });
  await expect(picker.getByRole("group", { name: "Muscle" }).getByRole("button", { name: "Lats", exact: true })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "Close" }).first().click();

  // add the first suggestion
  const add = calves.getByRole("button", { name: /^Add .* · \d sets$/ }).first();
  const label = (await add.textContent())!;
  const name = label.replace(/^Add /, "").replace(/ · \d sets$/, "");
  await add.dblclick(); // a double tap must not add it twice
  await expect(check.locator(".card").filter({ hasText: /^Lats: about/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Workout", exact: true }).click(); // Monday: Full Body A lists its exercises
  await expect(page.getByText(name, { exact: true })).toHaveCount(1);

  // focus muscles raise the bar
  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await page.getByRole("button", { name: /Program check/ }).click();
  await page.getByRole("group", { name: "Focus muscles (up to 3)" }).getByRole("button", { name: "Glutes" }).click();
  const glutes = page.locator(".card").filter({ hasText: /^Glutes is a focus muscle/ });
  await expect(glutes).toBeVisible();
  await glutes.getByRole("button", { name: "Ignore for now" }).click();
  await expect(glutes).toHaveCount(0);
});
