// Builds src/data/library/* from the free-exercise-db dump (Unlicense) + our extras + JA translations.
// Run: node scripts/build-library.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const src = read("./source/free-exercise-db.json");
const { EXTRAS } = await import("./source/extras.mjs");
const extras = EXTRAS;
const { FIXES } = await import("./source/instruction-fixes.mjs");

const tsv = p => new Map(readFileSync(new URL(p, import.meta.url), "utf8").split("\n").filter(Boolean).map(l => l.split("\t")));
const jaNames = tsv("./i18n/names-ja.tsv");

const jaInstr = {};
for (const f of readdirSync(new URL("./i18n/", import.meta.url)).filter(f => /^instr-ja-.*\.json$/.test(f))) Object.assign(jaInstr, read("./i18n/" + f));

const MUSCLE = { "middle back": "middle-back", "lower back": "lower-back" };
const muscle = m => MUSCLE[m] ?? m;

function equipment(e) {
  const n = e.name.toLowerCase();
  const set = new Set();
  const map = { "body only": "bodyweight", none: "bodyweight", machine: "machine", cable: "cable", dumbbell: "dumbbell", barbell: "barbell", kettlebells: "kettlebell", bands: "bands", "e-z curl bar": "ez-bar", other: "other", "foam roll": "other", "medicine ball": "other", "exercise ball": "other" };
  set.add(map[e.equipment ?? "none"] ?? "other");
  if (/smith/.test(n)) { set.delete("barbell"); set.delete("machine"); set.add("smith"); }
  if (/landmine/.test(n)) { set.add("landmine"); set.add("barbell"); }
  if (/\bez\b|e-z/.test(n)) { set.delete("barbell"); set.add("ez-bar"); }
  if (/kettlebell/.test(n)) set.add("kettlebell");
  if (/\bbands?\b/.test(n)) set.add("bands");
  if (/suspend|straps|\btrx\b/.test(n)) { set.delete("bodyweight"); set.add("trx"); }
  if (/bench|incline|decline|preacher|flat/.test(n) && (set.has("dumbbell") || set.has("barbell") || set.has("ez-bar") || set.has("smith")) && !/bench jump|bench sprint|bench dips?$/.test(n)) set.add("bench");
  if (/bench dip/.test(n)) set.add("bench");
  if (/pull[- ]?ups?|\bchins?\b|chin-up|hanging|muscle up|\bhang\b(?! clean| snatch)|rocky pull|inverted row$|toes to|knee\/hip raise|gironda|side to side chins|v-bar pullup|scapular/.test(n) && set.has("bodyweight")) set.add("pullup-bar");
  if (/sled|prowler|atlas|yoke|tire|keg|log lift|rickshaw|sandbag|battling|rope climb|circus|conan|car |axle|sledgehammer|stairmaster|step mill|elliptical|treadmill|bicycling|rowing, station|recumbent|air bike/.test(n)) { set.delete("bodyweight"); set.add("other"); }
  if (/\bdips?\b/.test(n) && !/bench dip|machine/.test(n) && set.has("other")) { set.delete("other"); set.add(/ring/.test(n) ? "trx" : "dip-bars"); }
  if (/pull[- ]?ups?|\bchins?\b|chin-up|muscle up|one handed hang/.test(n) && set.has("other")) { set.delete("other"); set.add("pullup-bar"); }
  if (/trap bar/.test(n)) { set.delete("other"); set.add("barbell"); }
  if (set.size > 1 && set.has("other") && !/sled|prowler|rope climb|sledgehammer/.test(n)) set.delete("other");
  return [...set];
}

function pattern(e, p0, eq) {
  const n = e.name.toLowerCase();
  const cat = e.category;
  if (cat === "stretching" || /stretch|smr|circles|rotations?$|foam|cat stretch|child's pose|inchworm|world's greatest|dancer|hug |pelvic tilt|superman|locust|windmills$/.test(n) && cat !== "strength") return "mobility";
  if (cat === "cardio") return "cardio";
  if (cat === "plyometrics") return "plyo";
  if (cat === "olympic weightlifting") return "olympic";
  if (/walk|carry|yoke|farmer|drag|sled push|prowler/.test(n)) return "carry";
  if (/deadlift|good morning|pull through|hyperextension|back extension|glute ham|hip thrust|glute bridge|butt lift|hip bridge|swing|rack pull|hip extension|hip lift|reverse hyper|kickback.*glute|glute kickback|romanian|pull-through|hip raise/.test(n)) return "hinge";
  if (/lunge|split squat|step[- ]?up|pistol|bulgarian|skater/.test(n)) return "lunge";
  if (/squat|leg press|hack/.test(n)) return "squat";
  if (/leg extension/.test(n)) return "knee-extension";
  if (/leg curl|hamstring slides|nordic/.test(n)) return "knee-flexion";
  if (/calf|donkey|tibialis/.test(n)) return "calf";
  if (/curl/.test(n) && p0 === "forearms") return "grip";
  if (/wrist|finger|plate pinch|hand squeeze|roller/.test(n)) return "grip";
  if (/curl/.test(n) || p0 === "biceps") return "elbow-flexion";
  if (/triceps|tricep|skull|pushdown|jm press|tate|kickback|dumbbell raise.*triceps|close-grip.*press|svend/.test(n) && p0 === "triceps") return "elbow-extension";
  if (/shrug/.test(n)) return "shrug";
  if (/face pull|rear|reverse fl|reverse machine|back flyes|bent over.*lateral/.test(n) && !/pull[- ]?up/.test(n)) return "fly";
  if (/lateral raise|side lateral|side raise|front raise|front .*raise|deltoid raise|raise.*delt|scaption|upright row|laterals|shoulder raise|front plate/.test(n)) return "shoulder-raise";
  if (/fly|flye|crossover|butterfly|pec deck|hug a ball/.test(n)) return "fly";
  if (/pulldown|pull-?up|\bchins?\b|chin-up|lat pull|muscle up|pullover/.test(n) && !/face pull/.test(n)) return "v-pull";
  if (/row|pull-in|high pull|pull apart|shotgun/.test(n)) return "h-pull";
  if (/overhead|military|shoulder press|push press|arnold|handstand|jerk|cuban|bradford|neck press|behind neck|\bpress\b.*shoulder/.test(n) && p0 === "shoulders") return "v-press";
  if (/bench|chest press|push-?up|dip|floor press|\bpress\b|bench press|svend|squeezes/.test(n) && ["chest", "triceps", "shoulders"].includes(p0)) return "h-push";
  if (p0 === "abdominals" || /crunch|sit-up|plank|rollout|leg raise|twist|woodchop|wood chop|pallof|bridge$|dead bug|mountain|flutter|scissor|jackknife|vacuum|cocoon|hanging pike|ab /.test(n)) return /twist|woodchop|wood chop|pallof|rotation|side bend|oblique/.test(n) ? "rotation" : "core";
  if (p0 === "adductors" || p0 === "abductors") return "hip-abduction";
  if (p0 === "neck") return "neck";
  const byMuscle = { chest: "h-push", shoulders: "v-press", lats: "v-pull", "middle-back": "h-pull", traps: "shrug", biceps: "elbow-flexion", triceps: "elbow-extension", quadriceps: "squat", hamstrings: "hinge", glutes: "hinge", calves: "calf", "lower-back": "hinge", forearms: "grip" };
  void eq;
  return byMuscle[p0] ?? "other";
}

function fatigue(e, pat, mech, eq, p0) {
  if (["mobility"].includes(pat)) return 1;
  if (pat === "cardio") return 2;
  if (pat === "plyo") return 3;
  if (pat === "olympic") return 4;
  if (pat === "carry") return 4;
  const n = e.name.toLowerCase();
  if (/deadlift|squat/.test(n) && eq.includes("barbell") && !/one leg|split|front|goblet|hack|box/.test(n) && pat !== "mobility") return 5;
  if (mech === "i") return ["quadriceps", "hamstrings", "glutes", "lats", "chest"].includes(p0) ? 2 : 1;
  let f = 3;
  if (eq.some(x => ["barbell", "smith", "ez-bar", "landmine"].includes(x))) f += 1;
  if (eq.includes("machine") || eq.includes("cable") || eq.includes("bands")) f -= 1;
  if (eq.includes("bodyweight") && !eq.includes("pullup-bar")) f -= 1;
  if (["quadriceps", "hamstrings", "glutes", "lower-back"].includes(p0) && ["squat", "hinge", "lunge"].includes(pat)) f += 1;
  if (pat === "core") f = Math.min(f, 2);
  return Math.max(1, Math.min(5, f));
}

function joints(e, pat, eq) {
  const n = e.name.toLowerCase();
  const j = new Set();
  if (/behind (the )?neck|upright row|dip|bench press|overhead|military|handstand|snatch|jerk|arnold|cuban|press/.test(n) && ["v-press", "h-push", "shoulder-raise", "olympic"].includes(pat)) j.add("shoulder");
  if (["hinge", "olympic"].includes(pat) || /bent over|good morning|row|squat/.test(n) && eq.some(x => ["barbell", "smith"].includes(x))) j.add("lower-back");
  if (["squat", "lunge", "plyo", "knee-extension"].includes(pat)) j.add("knee");
  if (pat === "elbow-extension" || /skull|curl/.test(n) && eq.includes("barbell")) j.add("elbow");
  if (pat === "grip" || /push-?up|front squat|clean|snatch/.test(n)) j.add("wrist");
  if (pat === "neck") j.add("neck");
  return [...j];
}

const out = [];
const instrEn = {};
const missingJa = [];

function add(rec, steps, jaSteps) {
  out.push(rec);
  instrEn[rec.id] = steps;
  if (jaSteps?.length) instrJa[rec.id] = jaSteps;
}
const instrJa = {};

for (const e of src) {
  const p = e.primaryMuscles.map(muscle);
  const s = (e.secondaryMuscles ?? []).map(muscle);
  const eq = equipment(e);
  const mech = e.mechanic === "isolation" ? "i" : e.mechanic === "compound" ? "c" : null;
  const pat = pattern(e, p[0], eq);
  const ja = jaNames.get(e.name);
  if (!ja) missingJa.push(e.name);
  add(
    {
      id: e.id, n: e.name, j: ja ?? e.name, p, s, e: eq, pat, m: mech ?? (pat === "mobility" || pat === "cardio" ? null : "c"),
      d: { beginner: 1, intermediate: 2, expert: 3 }[e.level] ?? 2, f: fatigue(e, pat, mech, eq, p[0]),
      cat: e.category, img: (e.images ?? []).length, jt: joints(e, pat, eq),
    },
    FIXES[e.id]?.replace ? FIXES[e.id].en : e.instructions?.length ? e.instructions : FIXES[e.id]?.en ?? [],
    jaInstr[e.id] ?? FIXES[e.id]?.ja,
  );
}
for (const x of extras) add({ img: 0, jt: [], cat: "strength", ...x.meta }, x.en, x.ja);

if (missingJa.length) { console.error("Missing JA names:", missingJa); process.exit(1); }

const dir = new URL("../src/data/library/", import.meta.url);
writeFileSync(new URL("index.json", dir), JSON.stringify(out));
writeFileSync(new URL("instructions.en.json", dir), JSON.stringify(instrEn));
writeFileSync(new URL("instructions.ja.json", dir), JSON.stringify(instrJa));

const count = k => out.reduce((m, r) => ((Array.isArray(r[k]) ? r[k] : [r[k]]).forEach(v => (m[v] = (m[v] ?? 0) + 1)), m), {});
console.log("exercises:", out.length, "| ja instructions:", Object.keys(instrJa).length);
console.log("pattern", JSON.stringify(count("pat")));
console.log("equipment", JSON.stringify(count("e")));
console.log("fatigue", JSON.stringify(count("f")));
