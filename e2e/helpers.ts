import type { Page } from "@playwright/test";

/** Most flows start from a returning-user state: skip the first-run setup. */
export async function skipOnboarding(page: Page) {
  await page.getByRole("button", { name: /^(Skip setup|設定をスキップ)$/ }).click();
}
