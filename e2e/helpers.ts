import type { Page } from "@playwright/test";

/** The one-time safety notice: tick and continue. */
export async function acceptSafety(page: Page) {
  const gate = page.getByRole("dialog", { name: /^(Before you start|はじめる前に)$/ });
  await gate.getByRole("checkbox").check();
  await gate.getByRole("button", { name: /^(Continue|続ける)$/ }).click();
}

/** The quick tour shown once after setup. */
export async function dismissTour(page: Page) {
  await page.getByRole("dialog", { name: /^(Quick tour|かんたんガイド)$/ }).getByRole("button", { name: /^(Skip|スキップ)$/ }).click();
}

/** Most flows start from a returning-user state: accept the safety notice, skip the first-run setup and the tour. */
export async function skipOnboarding(page: Page) {
  await acceptSafety(page);
  await page.getByRole("button", { name: /^(Skip setup|設定をスキップ)$/ }).click();
  await dismissTour(page);
}
