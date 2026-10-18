import { expect, test } from "@playwright/test";
import { acceptSafety, dismissTour } from "./helpers";

// The phone is set to Japanese, the app to English: no Japanese may appear anywhere (dates, calendar, numbers…).
test.use({ locale: "ja-JP", timezoneId: "Asia/Tokyo", viewport: { width: 390, height: 844 } });

const cjk = /[぀-ヿ一-鿿]/;
// The only Japanese allowed in English mode: the language switch itself and the search hint that says it searches both.
const allowed = ["日本語", "Search exercises (English or 日本語)"];

async function japaneseOnScreen(page: import("@playwright/test").Page) {
  return page.evaluate(({ allowedTexts, src }) => {
    const re = new RegExp(src);
    const out = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      if (!t || !re.test(t) || allowedTexts.some(a => t === a || a.includes(t))) continue;
      const el = n.parentElement;
      if (el && getComputedStyle(el).display !== "none") out.add(t.slice(0, 60));
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label]")) {
      for (const v of [el.getAttribute("placeholder"), el.getAttribute("aria-label")]) if (v && re.test(v) && !allowedTexts.some(a => v === a || v.includes(a) && v.replace(a, "").match(re) === null)) out.add(v.slice(0, 60));
    }
    return [...out];
  }, { allowedTexts: allowed, src: cjk.source });
}

test("English stays English on a Japanese phone: Workout tab, workout, history, progress calendar, coach, settings", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 14, 10, 0, 0) });
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).first().click(); // safety notice language switch
  await acceptSafety(page);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await dismissTour(page);
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Example" }).getByRole("button", { name: "Use this template" }).click();
  expect(await japaneseOnScreen(page)).toEqual([]);

  await page.getByRole("button", { name: "Workout", exact: true }).click();
  expect(await japaneseOnScreen(page)).toEqual([]);
  await page.getByRole("button", { name: "Start workout" }).click();
  const first = page.getByRole("article").first();
  await first.getByRole("textbox").nth(0).fill("60");
  await first.getByRole("textbox", { name: "Set 1 Reps" }).fill("8");
  await first.getByRole("button", { name: "Mark set done: Set 1" }).click();
  expect(await japaneseOnScreen(page)).toEqual([]);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  expect(await japaneseOnScreen(page)).toEqual([]);
  await page.getByRole("button", { name: "Save workout" }).click();

  for (const tab of ["Progress", "Coach", "Settings"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForTimeout(300);
    expect(await japaneseOnScreen(page), tab).toEqual([]);
  }
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  for (const sub of await page.getByRole("group").first().getByRole("button").all()) {
    await sub.click();
    await page.waitForTimeout(250);
    expect(await japaneseOnScreen(page), `Progress: ${await sub.textContent()}`).toEqual([]);
  }
});
