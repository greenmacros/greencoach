import { expect, test } from "@playwright/test";
import { acceptSafety, skipOnboarding } from "./helpers";

/** What GreenMacros puts after #nutrition= (src/lib/greencoach.js there). */
const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const day = (kcal: number, p: number) => [kcal, p, 280, 70];
const week = { v: 1, src: "greenmacros", at: "2026-10-12T00:00:00.000Z", days: [day(2500, 150), null, day(2500, 150), null, day(2300, 130), null, null], targets: [null, null, null, null, null, null, null] };

test("open a GreenMacros link: the planned week is linked and shown in Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#nutrition=${encode(week)}`);
  await acceptSafety(page);
  const sheet = page.getByRole("dialog", { name: "Use your GreenMacros plan?" });
  await expect(sheet.getByText("2433 kcal")).toBeVisible();
  await expect(sheet.getByText(/^143 g/)).toBeVisible();
  await page.screenshot({ path: "test-results/nutrition-import.png" });
  await sheet.getByRole("button", { name: "Use in GreenCoach" }).click();
  await expect(page.getByText("Nutrition plan linked.")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.getByRole("dialog", { name: "Quick tour" }).getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const card = page.getByRole("heading", { name: "Nutrition (GreenMacros)" }).locator("..");
  await expect(card.getByText("2433 kcal")).toBeVisible();
  await expect(card.getByText(/Averages over 3 planned days/)).toBeVisible();
  await card.getByRole("button", { name: "Unlink" }).click();
  await expect(card.getByText("Not linked yet.")).toBeVisible();
});

test("paste a GreenMacros link in Settings (home-screen app), and a broken link explains itself", async ({ page }) => {
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const card = page.getByRole("heading", { name: "Nutrition (GreenMacros)" }).locator("..");
  await card.getByRole("textbox", { name: "Paste the GreenMacros link" }).fill(`Week: https://greenmacros.github.io/greencoach/#nutrition=${encode(week)}`);
  await card.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByRole("dialog", { name: "Use your GreenMacros plan?" }).getByRole("button", { name: "Use in GreenCoach" }).click();
  await expect(card.getByText("2433 kcal")).toBeVisible();
  await page.goto("/#nutrition=zzzz");
  await expect(page.getByRole("dialog", { name: "Use your GreenMacros plan?" }).getByRole("alert")).toHaveText(/damaged or incomplete/);
});
