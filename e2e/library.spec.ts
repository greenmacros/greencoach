import { expect, test } from "@playwright/test";

test("library: search, open, favorite, swap, language switch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByText(/\d+ exercises/)).toBeVisible();

  await page.getByRole("searchbox").fill("bench press");
  await page.getByRole("listitem").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("How to")).toBeVisible();
  await dialog.getByRole("button", { name: /Swap/ }).click();
  await expect(dialog.getByRole("button").filter({ hasText: /Press/ }).first()).toBeVisible();
  await dialog.getByRole("button", { name: /Add to favorites/ }).click();
  await expect(dialog.getByRole("button", { name: /Remove from favorites/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // Japanese search + UI switch
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "日本語" }).click();
  await page.getByRole("button", { name: "プログラム" }).click();
  await page.getByRole("button", { name: "ライブラリ", exact: true }).click();
  await page.getByRole("searchbox").fill("ラットプルダウン");
  await expect(page.getByRole("listitem").first()).toContainText("ラットプルダウン");
  await page.screenshot({ path: "test-results/library-ja.png" });
});
