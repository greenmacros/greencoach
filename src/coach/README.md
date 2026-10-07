# GreenCoach coach engine

A deterministic, rule-based planner for the next training week. No LLM, no network, no randomness: the same
input always gives the same plan, and every suggestion carries a reason that the UI shows as one sentence ("Why").
The design is inspired by the publicly described ideas behind RP-style mesocycles (volume landmarks, RIR ladder,
feedback-driven set changes, deloads) and double progression for load. It is not affiliated with RP or MacroFactor.

All numbers live in [`config.ts`](config.ts); seasonal and calendar context is a table in [`seasons.ts`](seasons.ts).

## Files

| File | Role |
| --- | --- |
| `engine.ts` | `planNextWeek(input)`: orchestrates everything below |
| `config.ts` | Every tunable constant |
| `seasons.ts` | Season and holiday table (data, not logic) |
| `stats.ts` | Aggregations: weekly sets, per-exercise sessions, trends, feedback, adherence, body-weight rate |
| `volume.ts` | Landmark bands, week-1 volume, weekly set change per muscle |
| `allocate.ts` | Turns per-muscle set targets into per-exercise set counts |
| `load.ts` | Per-exercise weight / reps / RIR / rest |
| `deload.ts` | Early-deload detection |
| `apply.ts`, `records.ts` | Writing accepted suggestions into the program; remembering rejections |
| `explain.ts` | Reason → translated sentence (keys live in `src/i18n/messages-coach.ts`, EN + JA) |
| `fixtures.ts`, `*.test.ts`, `golden/` | Tests: 90+ unit cases plus golden plans |

## Inputs

Finished workouts (sets with weight, reps, RIR, set type; per-exercise difficulty 1-5, pump 0-3, joint pain 0-3,
volume rating 1-4; session feel and fatigue 1-5), soreness ratings (0 never sore, 1 healed a while ago, 2 healed
just in time, 3 still sore), the profile (experience, goal, phase, equipment, region, unit), the program and its
mesocycle settings, body-weight entries, and earlier rejections.

Warm-ups, unfinished and blank sets never count. Hard sets per muscle are weighted: primary muscle 1, secondary
`secondaryWeight` (0.5), because a bench press is real but partial triceps work.

## 1. Mode for the planned week

Checked in this order:

1. **first**: no finished workouts yet. Week 1 of a mesocycle, RIR 3, weights left blank ("pick a weight for
   lo-hi reps with ~3 in reserve").
2. **ramp**: last workout more than `gap.rampDays` (21) days ago. Ramp-in week: load x`gap.rampLoadFactor`
   (0.88), RIR `gap.rampRir` (4), volume dropped to max(MV, 70% of MEV). Restarts the mesocycle when accepted.
3. **deload (scheduled)**: the planned week is the last week of the mesocycle (accumulation weeks + 1).
4. **deload (early)**: from mesocycle week `deload.minMesoWeek` (3), any of:
   - 2+ muscles (`regressMuscles`) whose lifts lost more than `regressDrop` (2.5%) of estimated 1RM in each of
     their last two sessions;
   - average session fatigue over the last 3 sessions >= `fatigueAvg` (4/5);
   - average soreness >= `soreAvg` (2.5/3) and average difficulty >= `difficultyAvg` (4/5) over 2 weeks.
   Accepting it shifts the mesocycle so this week is the deload and a fresh mesocycle follows.
5. **welcome-back**: last workout more than `gap.welcomeBackDays` (7) days ago. Volume held; loads reduced
   linearly from -5% (7 days) to -10% (21 days).
6. **normal** otherwise.

Deload: every exercise to ceil(sets x 0.5), RIR 5, load x0.9. Sessions logged in a deload week are excluded
from all performance analysis, so the light week never looks like a regression.

## 2. RIR ladder

`rirLadder[accumulationWeeks]` gives the target RIR for each accumulation week, from 3 down to 0-1, for
mesocycles of 3-8 weeks (default 5 + 1 deload: 3, 2, 2, 1, 0). A first plan or ramp-in always uses week 1.

## 3. Volume per muscle (weekly hard sets)

### Landmarks
Per-muscle MV / MEV / MAV (low-high) / MRV in `config.landmarks` (intermediate defaults), scaled by:
- experience (`experience.*`): beginners have lower MAV/MRV (x0.8) and add at most 1 set a week;
  advanced lifters have higher MEV (x1.1), MAV (x1.15), MRV (x1.2) and start 2 sets above MEV;
- goal (`goal.*`): strength and maintain cap MAV/MRV lower and stop climbing earlier (`volumeFocus`);
- phase (`phase.*`): bulk raises MRV 10%, cut lowers it 15% (recovery is worse in a deficit);
- season: hot months lower MRV 5%.

The **soft cap** (how high plain progression may climb) is MEV + volumeFocus x (MAV high - MEV). MRV is the hard cap.

### Week 1
- First plan, no history: muscles below the starting volume (MEV + experience bonus) are raised to it; programs
  already in the productive range are kept as the user designed them; only volume above MAV high is trimmed.
- New mesocycle after a deload: start at 70% of the recent (8-week, non-deload) peak, between MEV and the middle
  of MAV. This is the "individual adjustment from history".

### Weekly change (week 2+), first matching rule wins
| Situation | Change | Reason key |
| --- | --- | --- |
| Joint pain >= 3 | -2 | `why.vol.cut.joint` |
| Joint pain >= 2 | hold (+ swap suggestion) | `why.vol.hold.joint` |
| Above MRV | down to MRV | `why.vol.cut.mrv` |
| At MRV | hold | `why.vol.hold.mrv` |
| Still sore (avg >= 2.5) and performance down | -1 (-2 if volume rated "too much") | `why.vol.cut.sore` |
| Volume rated "too much" (avg >= 3.5) | -1 | `why.vol.cut.toomuch` |
| Still sore, performance fine | hold | `why.vol.hold.sore` |
| Performance down (e1RM change <= -2%, x season tolerance) | hold | `why.vol.hold.perf` |
| Adherence below 60% of planned sessions | hold | `why.vol.hold.adherence` |
| User rejected extra sets in the last 2 weeks | hold | `why.vol.hold.rejected` |
| Cut phase and at/above MEV | hold | `why.vol.hold.cut` |
| Recovered (soreness <= 1) and low pump or "not enough" | +2 (capped by experience) | `why.vol.add.recovered` |
| Below MEV | +1 toward MEV | `why.vol.add.mev` |
| Healed just in time with a good pump | +1 | `why.vol.add.good` |
| At or above the soft cap | hold | `why.vol.hold.cap` |
| Otherwise | +1 toward MAV | `why.vol.add.default` |

Body weight: on a cut, losing more than 1% of body weight per week (7-day smoothed over 14 days) warns and takes
one set off muscles that would otherwise hold or grow. On a bulk, gaining more than 0.75%/week adds a note.
No diet or calorie advice is ever given.

### Allocation to exercises
Set changes go to exercises whose primary muscle matches, one set at a time: additions go to the session with the
fewest sets for that muscle, then the exercise with the fewest sets, then the least fatiguing one; removals take
from the exercise with the most sets. Limits: at most `maxSetsPerExercise` (6) per exercise, at least 2 for
compounds / 1 for isolation, and never more than `sessionCap` (10) weighted hard sets for one muscle in one session.
Sets that cannot be placed or removed are reported (`why.vol.unallocated` / `why.vol.unremovable`).
Muscles are processed prime-movers first, so secondary credit (e.g. triceps from presses) is counted before the
small muscles are planned.

## 4. Load and reps per exercise

Double progression with RIR correction:

1. Joint pain 3: load -10% and a swap; joint pain 2: hold and a swap.
2. Much harder than planned (reported RIR at least `rirGap` = 2 below the session's target, or difficulty 5 with
   any shortfall): back off 2.5% (5% when 3+ below).
3. Below the rep range by `belowRangeRepsGap` (2) reps, or at RIR 0 and under range: back off 2.5%;
   a smaller miss holds the weight.
4. Progress the load:
   - every working set at the top of the range at (about) the target RIR: +1 increment, reps back to the bottom;
   - RIR at least 2 above target: +2 increments ("bigger jump");
   - beginners: in range at the target RIR is enough (linear progression);
   - "too easy" (difficulty 1) +1 step, bulk +1 step when there was reserve; capped by experience
     (`maxLoadSteps`: beginner 2, intermediate 1, advanced 1, +1 when the reserve was large).
5. Otherwise: same weight, aim for one more rep (capped at the top of the range).

Increments (`load.inc`, kg; `load.incLb` for lb users): barbell 2.5 (5 for lower-body lifts at >= 80 kg),
EZ bar / Smith 2.5, dumbbells 1 below 12 kg and 2 above, kettlebell 2, cable 2.5, machine 2.5 (5 above 100 kg),
added load on bodyweight moves 2.5. Results are rounded to half an increment. Band-only exercises progress by
reps / band tier; assisted machines progress by reducing assistance. Plateau (no e1RM gain over 4 sessions)
adds a note and suggests a variation.

Goal and phase:
- strength: main compound lifts move to 3-6 reps and at least 3:30 rest; isolation to 8-12 if far higher;
- cut: intensity is protected; a load is only reduced for a severe miss (`loadDropTolerance`), and the plan
  always notes that maintaining strength on a cut is a win;
- bulk: one extra step when there was reserve.

Rests: at least the default for the exercise type (compound 2:30, isolation 1:30) plus the season's extra time.
The rule is idempotent: accepting a longer rest never gets the same addition again next week.

Exercises not done for more than 21 days (while other training continued) come back with the welcome-back reduction.

## 5. Season and calendar

`SEASONS` rows add rest time, scale MRV and loosen the performance thresholds (`perfTolerance`), plus notes:
Japan summer (Jun-Sep): +15 s rest, MRV x0.95, double tolerance, hydration reminder. Winter (Dec-Feb): longer
warm-up and mobility reminders. Northern/southern hemisphere rows mirror these. `DISRUPTIONS` mark Golden Week,
Obon and New Year (JP) and the year-end holidays (elsewhere) as likely disrupted weeks.

## 6. User decisions

Each exercise suggestion can be accepted, edited, or kept as is; "Accept all" accepts the rest. The first
decision of a week freezes the program snapshot the plan was made from, so the remaining proposals do not shift.
Accepted values are written into the program (sets, rep range, RIR, rest, target weight); the next workout
pre-fills the target weight. Rejected raises are stored and suppress the same raise for `rejectCooldownWeeks` (2).

## Tests

- `engine.test.ts`: 70+ scenario tests across modes, goals, phases, experience levels and edge cases
  (first week, no data, missed weeks, breaks, deloads, plateau, joint pain, seasons, body weight).
- `apply.test.ts`: applying, editing, swapping, remembering rejections; every reason key has EN and JA text.
- `golden.test.ts`: full plans for fixed histories compared with `golden/*.json`. After an intentional rule change,
  run `UPDATE_GOLDEN=1 npx vitest run src/coach` and review the diff.
