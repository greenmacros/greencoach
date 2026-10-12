import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

// A fixed Monday, so the test does not depend on the machine's time zone (the training day starts at 04:00).
const MONDAY = new Date(2026, 9, 5, 10, 0, 0);
const usePlan = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
};

test.describe("on iPhone Safari", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport: { width: 390, height: 844 } });

  test("shows the two Add to Home Screen steps, and Not now hides them for good", async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await page.clock.install({ time: MONDAY });
  await page.goto("/");
    await skipOnboarding(page);
    await usePlan(page);
    const card = page.getByRole("region", { name: "Install GreenCoach" });
    await expect(card.getByText("Tap Share in Safari's toolbar")).toBeVisible();
    await expect(card.getByText("Choose Add to Home Screen")).toBeVisible();
    await page.screenshot({ path: "test-results/install-ios.png" });
    await card.getByRole("button", { name: "Not now" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Install GreenCoach" })).toHaveCount(0);
    // still available in Settings
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("region", { name: "Install GreenCoach" })).toBeVisible();
  });
});

test("where the browser supports it (Android Chrome), an Install button opens the browser's prompt", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await skipOnboarding(page);
  await usePlan(page);
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => { (window as unknown as { prompted: boolean }).prompted = true; };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  const card = page.getByRole("region", { name: "Install GreenCoach" });
  await card.getByRole("button", { name: "Install" }).click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(card).toHaveCount(0); // the browser's prompt was used; nothing left to offer
});

test("nothing is shown where the browser cannot install (and once installed)", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await skipOnboarding(page);
  await usePlan(page);
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Install GreenCoach" })).toHaveCount(0);
});
