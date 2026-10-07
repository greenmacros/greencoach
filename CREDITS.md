# Credits

## Exercise data and images
- **free-exercise-db** by yuhonas: https://github.com/yuhonas/free-exercise-db
  License: The Unlicense (public domain dedication), verified in the repository's `LICENSE.md` and via the GitHub API (`spdx_id: Unlicense`).
  Used for: exercise names, muscles, equipment, instructions (English) and the two-frame images.
  Images are recompressed to 360 px-wide WebP (`public/ex/`) and loaded lazily.
- `scripts/source/free-exercise-db.json` is an unmodified copy of the upstream `dist/exercises.json`.

## Added by GreenCoach (this project)
- `scripts/source/extras.mjs`: 60 additional exercises with English and Japanese text.
- `scripts/source/instruction-fixes.mjs`: instructions for 5 upstream entries that had none.
- Derived fields (equipment taxonomy, movement pattern, fatigue cost, joint notes): `scripts/build-library.mjs`.
- Japanese names (`scripts/i18n/names-ja.tsv`) and Japanese instructions (`scripts/i18n/instr-ja-*.json`) are machine-assisted translations using gym-standard terms. **Community review is welcome**: edit those files and run `node scripts/build-library.mjs`.
