import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { acceptSafety, dismissTour } from "./helpers";

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

const L = {
  en: { next: "Next", lang: "English", start: "Start with this", startWorkout: "Start workout", done: (n: number) => `Mark set done: Set ${n}`, reps: (n: number) => `Set ${n} Reps`, finish: "Finish", save: "Save workout", coach: "Coach", why: /Why:/, fbSave: "Save" },
  ja: { next: "次へ", lang: "日本語", start: "これで始める", startWorkout: "ワークアウト開始", done: (n: number) => `セット完了: セット${n}`, reps: (n: number) => `セット${n} 回数`, finish: "終了", save: "ワークアウトを保存", coach: "コーチ", why: /理由:/, fbSave: "保存" },
} as const;

async function journey(page: Page, lang: "en" | "ja", theme: "light" | "dark") {
  const s = L[lang];
  await page.emulateMedia({ colorScheme: theme });
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme); // no flash of the wrong theme
  await acceptSafety(page);

  // 1. onboarding
  await page.getByRole("button", { name: s.lang, exact: true }).click();
  await page.getByRole("button", { name: s.next }).click();
  await page.getByRole("textbox").nth(1).fill("80"); // body weight
  await page.getByRole("button", { name: s.next }).click();
  await page.getByRole("button", { name: s.next }).click();
  await page.getByRole("button", { name: s.next }).click(); // my equipment
  await page.getByRole("button", { name: s.start }).first().click();
  await dismissTour(page);

  // 2. today's workout with the docked rest timer
  await page.getByRole("button", { name: s.startWorkout }).click();
  const first = page.getByRole("article").first();
  await first.getByRole("textbox").first().fill("60");
  await first.getByRole("textbox", { name: s.reps(1) }).fill("8");
  await first.getByRole("button", { name: s.done(1) }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: s.finish, exact: true }).click();
  await page.getByRole("button", { name: s.save }).click();

  // 3. next week's suggestions with reasons
  await page.getByRole("button", { name: s.coach, exact: true }).click();
  await expect(page.getByText(s.why).first()).toBeVisible();
  await page.screenshot({ path: `test-results/journey-${lang}-${theme}.png` });
}

test("new user journey in English, light mode", async ({ page }) => { await journey(page, "en", "light"); });
test("new user journey in Japanese, dark mode", async ({ page }) => { await journey(page, "ja", "dark"); });

test("works offline after the first load", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the service worker
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await acceptSafety(page);
  await expect(page.getByRole("button", { name: /^(Skip setup|設定をスキップ)$/ })).toBeVisible();
  await page.getByRole("button", { name: /^(Skip setup|設定をスキップ)$/ }).click();
  await dismissTour(page); // lazy chunk must come from the cache
  await page.getByRole("button", { name: "Program", exact: true }).click(); // lazy chunk must come from the cache
  await expect(page.getByText("Start from a template")).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByText(/\d+ exercises/)).toBeVisible();
  await context.setOffline(false);
});

for (const theme of ["light", "dark"] as const) {
  test(`no serious accessibility violations on main screens (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.clock.install({ time: MONDAY });
    await page.goto("/");
    const scan = async (where: string) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const bad = r.violations.filter(v => v.impact === "serious" || v.impact === "critical");
      expect(bad.map(v => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 2).map(n => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    };
    await scan("safety notice");
    await acceptSafety(page);
    await scan("onboarding");
    await page.getByRole("button", { name: "Next" }).click(); await page.getByRole("button", { name: "Next" }).click(); await page.getByRole("button", { name: "Next" }).click();
    await scan("my equipment");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start with this" }).first().click();
    await scan("quick tour");
    await dismissTour(page);
    await scan("today");
    await page.getByRole("button", { name: "Start workout" }).click();
    await scan("workout");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    for (const tab of ["Program", "Progress", "Coach", "Settings"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(150);
      await scan(tab);
    }
  });
}

test("the safety notice must be confirmed once, and stays readable in Settings", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "Before you start" });
  await expect(gate.getByText(/not medical advice/)).toBeVisible();
  await page.screenshot({ path: "test-results/safety.png" });
  await expect(gate.getByRole("button", { name: "Continue" })).toBeDisabled();
  // readable in either language before agreeing
  await gate.getByRole("button", { name: "日本語" }).click();
  const ja = page.getByRole("dialog", { name: "はじめる前に" });
  await expect(ja.getByText(/医学的な助言ではなく/)).toBeVisible();
  await ja.getByRole("button", { name: "English" }).click();
  await gate.getByRole("checkbox").check();
  await gate.getByRole("button", { name: "Continue" }).click();
  await expect(gate).toBeHidden();
  await page.waitForTimeout(500); // let the settings write land before reloading
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip setup" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Before you start" })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await dismissTour(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "About & safety" })).toBeVisible();
  await expect(page.getByText(/^Agreed on /)).toBeVisible();
});

test("pick my equipment during setup; the library and the starting plan follow it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await acceptSafety(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "My equipment" })).toBeVisible();
  await page.getByRole("button", { name: "Bands only" }).click();
  await page.getByRole("group", { name: "My equipment" }).getByRole("button", { name: "Dumbbell" }).click();
  await page.getByRole("textbox", { name: "Heaviest dumbbell (kg, optional)" }).fill("12");
  await page.screenshot({ path: "test-results/my-equipment.png" });
  await page.getByRole("button", { name: "Next" }).click();
  // dumbbells + bands: the home template is recommended
  await expect(page.getByRole("article", { name: "Home dumbbells + bands" }).getByRole("button", { name: "Start with this" })).toBeVisible();
  await page.getByRole("article", { name: "Home dumbbells + bands" }).getByRole("button", { name: "Start with this" }).click();
  await dismissTour(page);

  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search exercises" }).fill("barbell bench press");
  await expect(page.getByRole("button", { name: "My equipment" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Barbell Bench Press - Medium Grip")).toHaveCount(0);
  await page.getByRole("button", { name: "My equipment" }).click();
  await expect(page.getByText("Barbell Bench Press - Medium Grip").first()).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My equipment" })).toBeVisible();
  await expect(page.getByRole("group", { name: "My equipment" }).getByRole("button", { name: "Bands" })).toHaveAttribute("aria-pressed", "true");
});

test("quick tour: shown once after setup, swipe through, replay from Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await acceptSafety(page);
  await page.getByRole("button", { name: "Skip setup" }).click();
  const tour = page.getByRole("dialog", { name: "Quick tour" });
  await expect(tour.getByRole("heading", { name: "Your workout of the day" })).toBeVisible();
  await page.screenshot({ path: "test-results/tour-1.png" });
  for (let i = 0; i < 5; i++) await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Your data stays with you" })).toBeVisible();
  await tour.getByRole("button", { name: "Start training" }).click();
  await expect(tour).toBeHidden();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Quick tour" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Show the quick tour" }).click();
  await expect(page.getByRole("dialog", { name: "Quick tour" }).getByRole("heading", { name: "Your workout of the day" })).toBeVisible();
});
