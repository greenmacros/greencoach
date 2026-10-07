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
