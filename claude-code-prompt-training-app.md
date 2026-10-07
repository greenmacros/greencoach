# Build: "GreenCoach" — a free, local-first training PWA with an RP-style smart coach

You are building a complete, production-quality web app from scratch. Work autonomously: plan first, then build in milestones, running the app and the tests after each milestone. Do not stop to ask questions unless something is truly blocking; make sensible decisions and record them in `DECISIONS.md`.

If a sibling project called **GreenMacros** exists on this machine or in the working repos, inspect how it handles user storage, PWA install, theming and i18n, and mirror its conventions. Otherwise follow the spec below.

## 1. Goal and principles

A training tracker + auto-coach that is **free for life**: no accounts, no backend, no paywall, no ads, no tracking. All data lives on the user's device. It should feel like RP Hypertrophy / MacroFactor Workouts: the user logs sets, says how the session felt, and the app proposes next week's targets with a clear explanation.

Principles: fast logging (one-handed, in a gym), offline-first, explainable suggestions (never a black box), the user can always override.

## 2. Tech stack (decide, then document)

- TypeScript, React + Vite (or SvelteKit if you prefer; pick one and stay consistent).
- PWA: manifest, service worker, installable to the home screen, fully offline after first load. Use `vite-plugin-pwa` or equivalent.
- Storage: IndexedDB via `Dexie` (or `idb`). Versioned schema with migrations. Request persistent storage (`navigator.storage.persist()`).
- Tailwind CSS (or CSS modules), mobile-first, works well from 360px to desktop.
- Charts: `uPlot` or `Recharts` (lightweight).
- i18n: `i18next` or a small typed dictionary. Locales: `en`, `ja`.
- Tests: Vitest for the coaching engine and the scheduler, Playwright for 3-4 core flows.
- Deployable as a static site (GitHub Pages / Cloudflare Pages / Netlify). Include deploy instructions in the README.

## 3. User storage (like GreenMacros: web, or installed to home screen)

- Local-first: everything in IndexedDB. Works identically in a browser tab and as an installed PWA.
- Settings -> Data: **Export** all data as one JSON file, **Import** (with validation and a merge/replace choice), **Delete all data**.
- Optional auto-backup reminder (e.g. every 2 weeks, "Export your data").
- Show a small "Storage: on this device" indicator and warn that clearing browser data deletes everything unless exported.
- Design the data layer behind a repository interface so a sync backend could be added later without touching UI code (do not build the sync).

## 4. Features

### 4.1 Onboarding and profile
Language (EN/JA, default from browser), units (kg/lb, cm), sex (optional), age (optional), body weight, height (optional), **experience level** (beginner <1y, intermediate 1-3y, advanced 3y+), **goal** (build muscle, lose fat/cut, strength, maintain, recomp), **phase** (bulk, cut, maintain), days/week available, equipment available (home, bands only, dumbbells, full gym). Everything editable later.

### 4.2 Exercise library (large)
- Target: **800+ exercises**. Seed from the public-domain dataset `yuhonas/free-exercise-db` (Unlicense) and extend it. Verify the license yourself before bundling and note it in `CREDITS.md`.
- Each exercise: id, EN name, JA name, primary muscles, secondary muscles, equipment, movement pattern, mechanic (compound/isolation), difficulty, instructions (EN/JA), fatigue-cost rating (1-5), joint-stress notes, images.
- Equipment taxonomy (filterable, multi-select): barbell, dumbbell, cable, machine, **smith machine**, EZ bar, kettlebell, **resistance bands**, bodyweight, pull-up bar, bench, TRX/suspension, landmine, sled/other.
- Search (EN and JA, fuzzy), filters by muscle / equipment / pattern, favorites, recently used, custom exercises (user can create, with photo optional).
- Substitution: from any exercise, "Swap" suggests alternatives with the same primary muscle and pattern, filtered by the user's equipment.
- **Images / GIFs:** use the dataset's images (2-frame start/end images; auto-animate them as a looping crossfade so they behave like a GIF). Bundle lazily and cache with the service worker. Support an optional `media` field so the user or later releases can attach real GIFs/MP4s. Do **not** scrape copyrighted GIFs from commercial sites. Use a clean placeholder if no media exists.
- Japanese names: generate a complete JA translation file for the library (machine-translated is acceptable, then reviewed for gym-standard terms like ベンチプレス, ラットプルダウン, レッグプレス) and mark it for community review.

### 4.3 Weekly program builder
- User creates a **weekly program**: for each weekday (Mon-Sun) assign a session (or Rest). Sessions contain ordered exercises with sets, rep range, target RIR, rest time, notes, optional supersets.
- Templates to start from: Full body 3x, Upper/Lower 4x, Push/Pull/Legs 6x, Bro split 5x, Home dumbbell+bands, plus **Blank**. Templates are editable copies.
- **Date-driven day switching:** the Home screen automatically shows **today's session based on the current date** (user's local timezone, honoring a configurable "day starts at 04:00" so late-night sessions count for the same day). The user can still tap another day, mark today as skipped, or swap days ("move Push to tomorrow") without breaking the week.
- Mesocycle view: programs run in mesocycles (default 5 weeks accumulation + 1 deload, configurable 3-8). Show week N of M.

### 4.4 Workout screen (program + rest timer on the SAME page)
- Single scrolling page: exercise cards with set rows (weight, reps, RIR/effort, done checkbox), previous-session values shown inline, "copy last set", +/- steppers, large tap targets, numeric keypad.
- **Rest timer is docked on this same page** (sticky bottom bar, not a separate screen). Starts automatically when a set is checked. Presets **1:30, 2:00**, plus **Custom**. **Save recently used custom times** (keep last 5, tap to reuse, long-press to remove). Per-exercise default rest overrides allowed. Controls: +15s / -15s, skip, pause. Works with the screen locked via timestamps (not setInterval drift), plays a sound and vibrates, and fires a notification if permission is granted. Optional keep-screen-awake (Wake Lock API).
- Set types: normal, warm-up, drop set, myo-rep, failure. Add/remove sets and exercises mid-workout, reorder, notes.
- Post-exercise and post-session **feedback prompts** (fast, 1 tap each, see 4.5): difficulty/how it felt, pump, soreness from last time, joint pain.
- PR detection (weight, reps, estimated 1RM, volume) with a subtle celebration.
- Finish workout -> summary (duration, volume, PRs, muscle-set tally) -> saves to history. Auto-save draft so an accidental refresh never loses a session.

### 4.5 The smart coach (most important feature: make it genuinely good)
Build a deterministic, rule-based, **explainable** engine in `src/coach/` as pure functions with extensive unit tests. No LLM calls. Inspired by RP's mesocycle logic and MacroFactor's progression, with the following inputs and behavior.

**Inputs**
- Logged sets: weight, reps, RIR/RPE per set, set type.
- Per-session feedback: perceived difficulty/"toughness of the exercise" (1-5: too easy ... brutal), pump (0-3), joint pain (0-3, per exercise), session fatigue.
- Per-muscle weekly feedback: soreness at the start of the next session for that muscle (healed before next session / healed just in time / still sore), performance trend.
- Profile: goal, phase (bulk/cut/maintain), experience level, body weight trend (7-day smoothed), **season** (see below), days available, adherence (sessions completed vs planned).
- Mesocycle position (week index, deload flag).

**Volume management (per muscle, per week)**
- Per-muscle landmarks (MV, MEV, MAV, MRV, in hard sets/week) with defaults by muscle, scaled by experience (beginners start nearer MEV and progress slower; advanced have higher tolerance).
- Week 1 starts around MEV (+ individual adjustment from history), then adds sets week to week toward MAV/MRV.
- Next-week set adjustment per muscle using feedback, for example: soreness did not heal + performance dropped -> hold or reduce sets; low pump + fully recovered + performance up -> add 1-2 sets; hitting MRV or joint pain >= 2 -> cap or suggest exercise swap. Respect min/max sets per exercise and per session (avoid >10-12 hard sets per muscle per session).
- Automatic **deload** triggers: scheduled end of meso OR early deload when performance regresses across 2+ sessions for 2+ muscles, or accumulated fatigue is high.

**Load and rep progression (per exercise)**
- Target RIR ladder across the meso (e.g. 3 -> 2 -> 1 -> 0-1, deload at ~5 RIR with ~50% volume).
- Suggest next-week weight via estimated 1RM / double progression: reach the top of the rep range at the target RIR -> increase load by the smallest sensible increment (equipment-aware: 2.5 kg barbell, 1-2 kg dumbbell steps, cable stack steps, band tiers), reset reps to the bottom of the range; below range -> hold or reduce.
- Use how it **felt** (RIR and difficulty rating) to correct: reported RIR much lower than target -> back off 2.5-5%; much higher -> bigger jump.
- Compound vs isolation use different jump sizes and rep ranges (compound 5-10, isolation 10-20 by default), beginner vs advanced progression rates differ (linear for beginners, slower weekly micro-progressions for advanced).

**Goal / phase modifiers**
- Build muscle: volume progression emphasized, moderate rep ranges.
- Strength: lower reps, higher load focus, more rest suggested (3-5 min on main lifts), volume capped.
- Cut (fat loss): **maintain intensity (load), reduce or hold volume**, because recovery is lower in a deficit; flag expectations ("maintaining strength is a win on a cut"); lower MRV by ~10-20%; deload sooner if performance drops fast.
- Bulk: allows higher volume ceilings and faster load progression.
- Body weight trend: losing weight too fast on a cut (>1% BW/week) -> warn and tone down volume; gaining too fast on a bulk -> note it. Do not give calorie or diet advice; only training.

**Season / context awareness**
- Use the date and hemisphere/region setting (default Japan): hot humid summer (Jun-Sep) -> slightly longer rests, hydration reminder, reduce MRV a touch, expect lower performance and do not over-penalize it; winter -> longer warm-ups, mobility reminder; add Obon/New Year/Golden Week as "likely disrupted schedule" hints. Make the seasonal rules a small, readable config table, not hard-coded logic.
- Missed sessions: if >7 days gap, restart the week at reduced load (about -5% to -10%) with a "welcome back" note; >21 days, reset to a ramp-in week.

**Output**
- A **"Next week" screen**: for each exercise and muscle, proposed sets/reps/weight/RIR, with a colored delta vs last week (up / same / down) and a one-line **"Why"** (e.g. "Chest: sore for 2 days after last session and reps dropped, so holding at 12 sets"). The user can accept all, edit any value, or reject a suggestion. Rejections are remembered as a signal.
- Suggestions can also propose swaps (joint pain) and a deload.
- Include a `coach/README.md` documenting every rule, constant and its rationale, and a golden-file test suite: given a fixture history, the engine must produce expected suggestions. Include at least 40 test cases across goals, experience levels, phases and edge cases (first week, no data, missed weeks, deload, plateau).
- Make constants tunable in one config file.

### 4.6 Progress tracking
- Screens with range selector: **week / month / 3 months / year / all-time**.
- Charts: estimated 1RM per exercise, top-set weight, total volume (sets x reps x weight), hard sets per muscle per week vs landmarks (heatmap + bars), body weight trend (with a smoothed line), training frequency/adherence calendar (streak heatmap), PR timeline, session duration.
- Body metrics logging: weight, optional waist/chest/arms/etc. Optional progress photos stored locally (compressed, never uploaded).
- Per-exercise history page with all sessions, notes and PRs.

### 4.7 Goal setting (low prominence, but present)
Settings -> Goals: e.g. "Bench 100 kg by 2027-03-01", body-weight target and date, weekly session target. Show progress bars on the Progress tab, a gentle projected date based on the current trend, and mark achieved. Goals may inform coach messaging but never override safety rules.

### 4.8 Appearance and language
- **Dark and light mode**, with System / Light / Dark option, no flash of wrong theme on load, accessible contrast (WCAG AA).
- **English and Japanese** across the entire UI, exercise names/instructions, coach explanations, dates and number formats. Language switch in-app, no reload. Use proper Japanese typography (appropriate font stack, no clipped text; test long strings).
- Units: kg/lb, with conversion preserved in history.

## 5. UX requirements
- Bottom tab bar: Today, Program, Progress, Coach (next week), Settings. Library accessible from Program and workout screens.
- Today screen: today's session at a glance with a big Start button, week strip showing the current day, rest-day state with a quick manual workout option.
- Mobile-first, one-handed use, large inputs, haptics where supported, undo for destructive actions, no modal overload.
- Performance: fast first paint, library virtualized, <200 KB JS initial where practical, lazy-load images.
- Accessibility: labelled controls, keyboard navigation on desktop, reduced-motion respected.

## 6. Data model (sketch, refine it)
`Profile`, `Settings`, `Exercise` (seed + custom), `Program` -> `Week template` -> `SessionTemplate` -> `ExerciseSlot`, `Mesocycle`, `WorkoutLog` -> `ExerciseLog` -> `SetLog`, `Feedback` (session/exercise/muscle), `BodyMetric`, `Goal`, `CoachSuggestion` (with `reason` and accepted/rejected state), `RestTimerPresets`. Every record has `id`, `createdAt`, `updatedAt`, and a `schemaVersion`. Dates are stored as ISO strings in UTC plus a local-day key.

## 7. Milestones (do them in order; commit after each)
1. Scaffold, PWA, theming, i18n, storage layer, export/import.
2. Exercise library with seed data, search/filter, EN/JA names, images.
3. Program builder + date-driven Today screen.
4. Workout screen with set logging and the docked rest timer.
5. Feedback capture + history + PR detection.
6. Coaching engine + Next week screen + tests.
7. Progress charts + goals.
8. Polish: onboarding, empty states, accessibility pass, performance pass, Playwright flows, README, deploy config.

## 8. Definition of done
- `npm run build`, `npm test` and the Playwright flows pass.
- Installs to the home screen and works fully offline, on iOS Safari and Android Chrome.
- A new user can: onboard -> pick a template -> do today's workout with the rest timer -> finish -> see the next-week suggestion with reasons, in both English and Japanese, in dark and light mode.
- README covers setup, architecture, the coaching rules overview, data export/import, and deployment. `CREDITS.md` lists all data/image sources and licenses.

Start by writing a short plan and the repo structure, then begin milestone 1.
