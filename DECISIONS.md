# Decisions

## Plan
Eight milestones, built in order, each committed: (1) scaffold/PWA/theme/i18n/storage/export-import, (2) exercise library, (3) program builder + Today, (4) workout screen + docked rest timer, (5) feedback/history/PRs, (6) coach engine + Next week + tests, (7) progress + goals, (8) polish, Playwright, docs, deploy.

## Conventions mirrored from GreenMacros (/Users/fabianiz/Documents/green-macros)
- Vite `base: "./"` so the app works on any host or subpath.
- Theme applied by an inline script in `index.html` before first paint (no flash); `data-theme` on `<html>`.
- Flat i18n dictionary `key -> {en, ja}` with `{var}` interpolation, English fallback, language detected from `navigator.language`.
- Backup file envelope: `app`, `version`, `exportedAt`, `counts`, plus data; timestamped file names (`...-YYYY-MM-DD-HHMMSS.json`).
- Gentle banners: iOS "Add to Home Screen" tip and "export your data" reminder.
- Differences: TypeScript, IndexedDB (Dexie) instead of localStorage, `vite-plugin-pwa` (Workbox precache) instead of a hand-written service worker.

## Stack
React 19 + Vite + TypeScript, Tailwind v4 (with CSS variables for the light/dark tokens), Dexie, vite-plugin-pwa, Vitest (+ fake-indexeddb). Charts (uPlot) and Playwright are added in the milestones that need them.

## Data layer
- UI talks only to the `Repository` interface (`src/db/repository.ts`); `src/db/index.ts` picks the Dexie implementation. A sync backend would be another implementation.
- All 11 tables are created in schema v1 so later milestones need no migration; they hold generic records until their types are added.
- Every record: `id`, `createdAt`, `updatedAt`, `schemaVersion`. Dates are UTC ISO strings; workouts also get a local `dayKey` honoring the day-start hour.
- Import validates the whole file before writing anything. Merge keeps the record with the newest `updatedAt`; Replace clears first. Both run in one transaction.
- Theme and language are mirrored in localStorage only so the first paint is right; IndexedDB settings are the source of truth.
- `navigator.storage.persist()` is requested on startup.

## Exercise library (M2)
- Seeded from free-exercise-db (Unlicense, verified), 876 entries + 61 GreenCoach extras = 938. Bundled as static data (lazy chunk), not copied into IndexedDB; only custom exercises and favorites/recents live in the database.
- Equipment, movement pattern, fatigue cost and joint notes are derived by `scripts/build-library.mjs` (rules in that file) and spot-checked by tests.
- Japanese names: complete, hand-written with gym-standard terms. Japanese step-by-step instructions: complete for all 938 exercises (`scripts/i18n/instr-ja-*.json`, machine-assisted, です/ます style, US units converted to metric, marked for community review). The English-fallback notice remains for any future gaps.
- Images recompressed to 360px WebP (15 MB total), cached at runtime by the service worker (not precached).

## Program and schedule (M3)
- Training day = local date shifted by the "day starts at" hour (default 04:00). One-off changes are stored as per-day overrides; "move" swaps with the target day if it already has a session, so a week never loses a session.

## Workout (M4-M5)
- Rest timer is a pure timestamp state machine (`src/workout/timer.ts`), so it survives throttling and screen lock; the alert fires on the timeout or, if the page was suspended, the moment it becomes visible again. iOS cannot run timers while locked: documented in Settings.
- Feedback follows the RP-style pattern the user shared: a sheet after an exercise's last set (joint pain, soreness from last time for that muscle, pump, volume, difficulty).
- PRs: weight, estimated 1RM (Epley, reps only), reps at an exact weight, best set volume. The first time an exercise is done is a baseline, never a PR.

## Coach (M6)
- Pure functions in `src/coach/`, documented rule by rule in `src/coach/README.md`. All constants in `config.ts`; seasons/holidays in a table.
- First plan with no history keeps a program that is already in the productive range (raises below-MEV muscles, trims above MAV high) instead of resetting everything to MEV, so a chosen template is respected.
- The first decision in a week freezes a baseline program snapshot so remaining proposals do not shift as you accept items.

## Progress (M7)
- Charts are small hand-written SVG/HTML components instead of uPlot/Recharts: no dependency weight, exact control of the data-viz rules (2px lines, 8px markers with surface ring, 4px rounded bar ends, recessive grid, crosshair + tooltip with keyboard support, table view for every chart, validated light/dark palettes).
- Hard sets per muscle use the same weighting as the coach (secondary muscles count half) and are drawn against the user's MEV-MRV band.

## Name

- Renamed from GreenCoach to GreenCoach (another app already uses the GreenCoach name). Internal identifiers keep the old
  name on purpose so existing data survives: the IndexedDB database `greencoach`, the `lc_*` localStorage keys and the
  GitHub Pages path. Backups exported under the old name (`"app": "GreenCoach"`) are still accepted.
