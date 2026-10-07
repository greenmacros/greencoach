import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

async function makeLink(page: import("@playwright/test").Page) {
  await page.goto("/");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Example" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Share plan" }).click();
  const field = page.getByRole("dialog", { name: "Share this plan" }).getByRole("textbox", { name: "Plan link" });
  await expect(field).toHaveValue(/#plan=z/);
  await page.screenshot({ path: "test-results/share.png" });
  return field.inputValue();
}

test("share a plan as a link and import it on another device by opening the link", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const link = await makeLink(page);

  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await other.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  const sheet = other.getByRole("dialog", { name: "Import a shared plan" });
  await expect(sheet.getByText("Example: 4-day focus split")).toBeVisible();
  await expect(sheet.getByText(/4 sessions · 4 days a week/)).toBeVisible();
  await expect(sheet.getByText(/Smith Machine Bench Press 3×8-10/)).toBeVisible();
  await other.screenshot({ path: "test-results/import.png" });
  await sheet.getByRole("button", { name: "Import and use" }).click();
  await expect(other.getByText(/Plan imported: Example: 4-day focus split/)).toBeVisible();
  await expect(other.getByRole("textbox", { name: "Program name" })).toHaveValue("Example: 4-day focus split");
  expect(new URL(other.url()).hash).toBe("");
});

test("paste a plan link inside the app (home-screen app on iPhone)", async ({ page, browser }) => {
  const link = await makeLink(page);
  const other = await (await browser.newContext()).newPage();
  await other.goto("/");
  await skipOnboarding(other);
  await other.getByRole("button", { name: "Program", exact: true }).click();
  await other.getByRole("button", { name: "Import plan" }).click();
  await other.getByRole("textbox", { name: "Plan link" }).fill("Try my plan: " + link);
  await other.getByRole("button", { name: "Open", exact: true }).click();
  await other.getByRole("dialog", { name: "Import a shared plan" }).getByRole("button", { name: "Import and use" }).click();
  await expect(other.getByRole("textbox", { name: "Program name" })).toHaveValue("Example: 4-day focus split");

  // a broken link explains itself
  await other.goto("/#plan=zBROKEN");
  await expect(other.getByRole("alert")).toHaveText(/damaged or incomplete/);
});
