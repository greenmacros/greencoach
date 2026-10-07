import { expect, test } from "@playwright/test";

const TODAY = new Date(2026, 9, 7, 10, 0, 0); // Wed 2026-10-07
const day = (offset: number) => { const d = new Date(2026, 9, 7 + offset, 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const base = { createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", schemaVersion: 1 };

/** 8 weeks of twice-weekly bench + squat, slowly getting stronger, plus body weight and a goal. */
function backup() {
  const workouts = [];
  for (let wk = 8; wk >= 1; wk--) {
    for (const [i, off] of [[0, -wk * 7 - 2], [1, -wk * 7 + 1]] as const) {
      const d = day(off);
      const w = 70 + (8 - wk) * 2.5;
      const set = (kg: number, reps: number, n: number) => ({ id: `s${d}${i}${n}`, type: "normal", weightKg: kg, reps, rir: 2, done: true, doneAt: `${d}T10:00:00.000Z` });
      workouts.push({
        ...base, id: `w-${d}-${i}`, dayKey: d, programId: null, sessionId: null, sessionName: i ? "Lower" : "Upper", unit: "kg", notes: "",
        startedAt: `${d}T10:00:00.000Z`, finishedAt: `${d}T11:0${i}:00.000Z`,
        exercises: [{ id: `e${d}${i}`, exerciseId: i ? "Barbell_Squat" : "Barbell_Bench_Press_-_Medium_Grip", slotId: null, restSec: 150, notes: "", supersetGroup: null, target: null,
          sets: [set(i ? w + 30 : w, 8, 1), set(i ? w + 30 : w, 8, 2), set(i ? w + 30 : w, 7, 3)] }],
      });
    }
  }
  const bodyMetrics = Array.from({ length: 20 }, (_, i) => ({ ...base, id: `bm:${i}`, dayKey: day(-40 + i * 2), weightKg: 82 - i * 0.1 }));
  const goals = [{ ...base, id: "goal:1", kind: "lift", exerciseId: "Barbell_Bench_Press_-_Medium_Grip", targetKg: 120, achievedAt: null }];
  const empty = ["profile", "settings", "exercises", "programs", "mesocycles", "feedback", "suggestions", "timerPresets"];
  return { app: "GreenCoach", version: 1, exportedAt: "2026-10-07T00:00:00.000Z", counts: {}, tables: { workouts, bodyMetrics, goals, ...Object.fromEntries(empty.map(t => [t, []])) } };
}

test("import a backup, then progress charts, table view, body log and goals", async ({ page }) => {
  await page.clock.install({ time: TODAY });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByTestId("import-input").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup())) });
  await page.getByRole("button", { name: "Replace everything" }).click();
  await expect(page.getByText(/Imported: 37 added/)).toBeVisible();

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("Sessions").first()).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("figure", { name: "Weekly volume" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Hard sets per muscle", exact: true })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Training calendar" })).toBeVisible();
  await expect(page.getByRole("region", { name: "PR timeline" }).getByText(/Barbell Squat|Bench/).first()).toBeVisible();

  // table view of a chart
  const vol = page.getByRole("figure", { name: "Weekly volume" });
  await vol.getByRole("button", { name: "Table" }).click();
  await expect(vol.getByRole("table")).toBeVisible();
  await expect(vol.getByRole("columnheader", { name: /Volume/ })).toBeVisible();

  // goals with progress bar
  await expect(page.getByRole("progressbar", { name: /Barbell Bench Press - Medium Grip 120 kg/ })).toBeVisible();

  // exercise trend with hover tooltip
  await page.getByRole("button", { name: "Exercises", exact: true }).click();
  const chart = page.getByRole("img", { name: /strength trend/ });
  await expect(chart).toBeVisible();
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status").filter({ hasText: "Estimated 1RM" })).toBeVisible();

  // body: log today's weight, it appears in the list
  await page.getByRole("button", { name: "Body", exact: true }).click();
  await page.getByLabel("Body weight (kg)").fill("79.4");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("79.4 kg")).toBeVisible();
  await expect(page.getByRole("img", { name: "Body weight" })).toBeVisible();
  await page.screenshot({ path: "test-results/progress-body.png" });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "test-results/progress-overview.png", fullPage: true });
});
