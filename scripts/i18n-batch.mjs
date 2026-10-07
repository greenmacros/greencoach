// Print the next untranslated exercises' English instructions as compact text for translation.
// Usage: node scripts/i18n-batch.mjs <count>
import { readFileSync, readdirSync } from "node:fs";
const src = JSON.parse(readFileSync("scripts/source/free-exercise-db.json", "utf8"));
const done = {};
for (const f of readdirSync("scripts/i18n").filter(f => /^instr-ja-.*\.json$/.test(f))) Object.assign(done, JSON.parse(readFileSync("scripts/i18n/" + f, "utf8")));
const order = { strength: 0, powerlifting: 1, "olympic weightlifting": 2, strongman: 3, plyometrics: 4, cardio: 5, stretching: 6 };
const todo = src.filter(e => e.instructions.length && !done[e.id]).sort((a, b) => order[a.category] - order[b.category] || a.id.localeCompare(b.id));
const n = Number(process.argv[2] ?? 40);
console.log(`# remaining ${todo.length}`);
for (const e of todo.slice(0, n)) console.log(`@${e.id}\n` + e.instructions.map(s => "- " + s.replace(/\s+/g, " ").trim()).join("\n"));
