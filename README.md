# GreenCoach

A free, local-first training tracker with an explainable smart coach.
Log your sets, say how the session felt, and get next week's plan with a one-line reason for every change.

- **Free for life.** No accounts, no backend, no ads, no tracking.
- **Your data stays on your device** (IndexedDB). Export / import a single JSON file whenever you like.
- **Works offline** and installs to the home screen (iOS Safari, Android Chrome, desktop).
- **English and 日本語** throughout, light and dark mode, kg or lb.

## Features

| Area | What you get |
| --- | --- |
| Onboarding | Language, units, theme, optional body data, experience, goal, phase, days per week, equipment, region, recommended starting template |
| Exercise library | 938 exercises (free-exercise-db + 61 additions) with English and Japanese names, fuzzy search in both languages (kana-insensitive, typo-tolerant), muscle / equipment / movement filters, favorites, recents, custom exercises with an optional photo, "Swap for…" alternatives within your equipment, two-frame demos that crossfade like a GIF |
| Programs | Weekly program builder (sessions, sets, rep range, target RIR, rest, notes, supersets), templates (Full body 3×, Upper/Lower 4×, PPL 6×, Bro split 5×, Home dumbbells + bands, an example 4-day focus split, Blank), mesocycles of 3-8 weeks + deload |
| Today | Today's session picked by date (the day starts at 04:00 by default), week strip, skip, move or swap a session, rest-day quick workout, resume an unfinished workout |
| Workout | One page: compact set table (weight, reps, RIR, log), last session's numbers inline, copy last set, stepper strip, set types (warm-up, drop, myo-rep, failure), add / skip / reorder, notes, **rest timer docked at the bottom**: 1:30 / 2:00 / custom (last 5 kept, long-press to remove), ±15 s, pause, skip, sound, vibration, notification, keep-screen-awake; auto-saved draft |
| Feedback | After an exercise: joint pain, soreness from last time for that muscle, pump, volume, difficulty. After the session: how it felt and fatigue |
| Bands | "My bands" in Settings: your own bands by name and color, lightest to heaviest (kg optional). Band exercises are logged by band (combine several), and the coach moves you up one band at a time |
| Records | Heaviest weight, estimated 1RM, reps at a weight, best set volume, with a subtle celebration |
| Coach | Next week's sets / reps / weight / RIR per exercise and weekly sets per muscle, each with a colored change and a "Why". Accept all, edit, or keep as is (remembered). Swap suggestions, deloads, welcome-back and ramp-in weeks, season and holiday awareness |
| Progress | Week / month / 3 months / year / all: volume, sets per muscle vs your productive range, per-muscle heatmap, training calendar, streak, adherence, session duration, PR timeline, per-exercise e1RM and top set, body weight with a smoothed trend, measurements, progress photos (on-device only), goals with projected dates |

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (Vitest): coach engine, scheduler, timer, PRs, storage, library, progress
npx playwright install chromium   # once
npx playwright test  # end-to-end flows (builds and serves the production bundle)
npm run build        # type-check + production build with the service worker
npm run preview      # serve the production build (try "Add to Home Screen" / offline here)
```

Regenerate the exercise library after editing data or translations:

```bash
node scripts/build-library.mjs
```

## Architecture

```
src/
  db/          Repository interface + Dexie (IndexedDB) implementation, backup format, defaults
  i18n/        Flat {key: {en, ja}} dictionaries, one file per area
  library/     Bundled exercise data access, search, substitutions, custom exercises
  program/     Program model, templates, pure scheduler (day keys, overrides, mesocycle position)
  workout/     Workout model, PR detection, timestamp rest timer, draft autosave
  feedback/    Soreness questions
  coach/       The coaching engine (pure functions) - see src/coach/README.md
  progress/    Progress statistics, body metrics, goals
  charts/      Small SVG/HTML chart components (line, bar, heatmap, muscle bars)
  pages/       Screens (all but Today are lazy-loaded)
  components/  Shared UI
scripts/       Library build pipeline and translation sources
e2e/           Playwright flows
```

- **Storage behind a repository.** UI code only talks to `Repository` (`src/db/repository.ts`). A sync backend could be added as another implementation without touching screens.
- **Every record** has `id`, `createdAt`, `updatedAt` and `schemaVersion`; dates are UTC ISO strings plus a local `dayKey`. Schema changes go through Dexie versions and `migrateRecord`.
- **Theme and language** are applied by an inline script before first paint (no flash), mirroring the GreenMacros conventions (see `DECISIONS.md`).
- **Performance.** Initial JavaScript is about 131 KB gzipped; the exercise index (31 KB gz), instructions, coach, charts and every non-Today screen load on demand. Exercise images are cached by the service worker the first time they are seen.

## The coach in one paragraph

Each muscle has volume landmarks (minimum, minimum effective, maximum adaptive, maximum recoverable hard sets per week), scaled by experience, goal, phase and season. Week 1 starts near the minimum effective volume; each week sets go up, hold or come down depending on soreness from last time, pump, your volume rating, joint pain, performance trend and how many sessions you actually did. Loads follow double progression: hit the top of the rep range at the target reps-in-reserve and the weight goes up by the smallest sensible step for that equipment; much harder than planned and it backs off; much easier and it jumps more. Target RIR walks down across the mesocycle (3 → 0-1), then a deload halves the sets. Breaks of a week or three get lighter "welcome back" or "ramp-in" weeks. Cuts protect intensity and hold volume; bulks allow more. Every rule, constant and rationale is in [`src/coach/README.md`](src/coach/README.md); constants live in one file, [`src/coach/config.ts`](src/coach/config.ts).

## Your data

Settings → Data:

- **Export all data**: one JSON file (`greencoach-backup-YYYY-MM-DD-HHMMSS.json`) with every table.
- **Import from file**: the whole file is validated first; then choose **Merge** (keeps the newest version of each record) or **Replace everything**.
- **Delete all data**: permanent, with confirmation.
- A reminder to export appears every 14 days by default (configurable). The app asks the browser for persistent storage; clearing browser data still deletes everything that was not exported.

Progress photos are compressed on the device and never leave it (they are included in exports).

## Deploy

`npm run build` writes a static site to `dist/` with relative paths, so it works on any host or subpath.

- **GitHub Pages**: push to `main`; `.github/workflows/deploy.yml` runs the unit and e2e tests, builds, and publishes. Enable Pages → "GitHub Actions" in the repository settings.
- **Netlify**: connect the repository; `netlify.toml` sets the build command, publish folder and cache headers.
- **Cloudflare Pages**: build command `npm run build`, output directory `dist`; `public/_headers` keeps the service worker uncached and hashed assets immutable.

Serve over HTTPS (all three do) so the service worker and installation work.

## Known limits

- Phones may pause web pages while the screen is locked. The rest timer is timestamp-based, so it is always correct when you look, but the end-of-rest beep or notification can be late. "Keep screen on" avoids this.
- Japanese names and step-by-step instructions cover all 938 exercises, but they are machine-assisted translations. Corrections are welcome in `scripts/i18n/` (see `CREDITS.md`).

## Credits and license

Exercise data and images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense). See [`CREDITS.md`](CREDITS.md).
