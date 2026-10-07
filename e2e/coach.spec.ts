import { expect, test } from "@playwright/test";

const MONDAY = new Date(2026, 9, 5, 10, 0, 0);

test("log a session, see next week's plan with reasons, accept it, and the next workout uses it", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Full body 3×" }).getByRole("button", { name: "Use this template" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start workout" }).click();

  // three squat sets at the top of the 5-8 range, 2 reps in reserve
  const squat = page.getByRole("article", { name: "Barbell Squat" });
  for (const n of [1, 2, 3]) {
    await squat.getByRole("textbox", { name: new RegExp(`^Set ${n} Weight`) }).fill("100");
    await squat.getByRole("textbox", { name: `Set ${n} Reps` }).fill("8");
    await squat.getByRole("combobox", { name: new RegExp(`^Set ${n} RIR`) }).selectOption("2");
    await squat.getByRole("button", { name: `Mark set done: Set ${n}` }).click();
  }
  await page.getByRole("dialog", { name: "Feedback" }).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Save workout" }).click();

  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Next week", level: 1 })).toBeVisible();
  const card = page.getByRole("article", { name: "Barbell Squat" });
  await expect(card.getByText(/Why:/)).toBeVisible();
  await expect(card.getByText(/adding 5 kg/)).toBeVisible(); // heavy lower-body barbell lift: +5 kg
  await expect(card.getByLabel(/Weight \(kg\): 105/)).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(card.getByText("✓ Accepted")).toBeVisible();

  // another exercise: keep as is
  const bench = page.getByRole("article", { name: "Barbell Bench Press - Medium Grip" });
  if (await bench.getByRole("button", { name: "Keep as is" }).count()) {
    await bench.getByRole("button", { name: "Keep as is" }).click();
    await expect(bench.getByText("Kept as is")).toBeVisible();
  }

  // muscle rows explain volume
  await expect(page.getByRole("heading", { name: "Weekly sets per muscle" })).toBeVisible();
  await expect(page.getByLabel("Quads").getByText(/Quads:/).first()).toBeVisible();

  // Next Monday: the squat is pre-filled with the accepted weight
  await page.clock.setFixedTime(new Date(2026, 9, 12, 10, 0, 0));
  await page.reload();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("article", { name: "Barbell Squat" }).getByRole("textbox", { name: /^Set 1 Weight/ })).toHaveValue("105");
});

test("Japanese coach screen", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "日本語" }).click();
  await page.getByRole("button", { name: "プログラム", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "上半身／下半身 週4回" }).getByRole("button", { name: "このテンプレートを使う" }).click();
  await page.getByRole("button", { name: "コーチ", exact: true }).click();
  await expect(page.getByText("最初の週").first()).toBeVisible();
  await expect(page.getByText(/履歴がまだありません/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/coach-ja.png", fullPage: false });
});
