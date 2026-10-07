import type { ExerciseSlot, Program, SessionTemplate } from "./types";
import { newId, } from "../lib/id";
import type { Lang } from "../db/types";
import { weekStart } from "./schedule";

type Names = { en: string; ja: string };

interface SlotSpec { id: string; sets: number; reps: [number, number]; rir?: number; rest?: number; note?: Names }
interface SessionSpec { name: Names; slots: SlotSpec[] }
export interface TemplateSpec {
  id: string;
  name: Names;
  blurb: Names;
  daysPerWeek: number;
  /** Monday..Sunday: index into `sessions`, or null for rest. */
  week: (number | null)[];
  sessions: SessionSpec[];
  accumulationWeeks?: number;
}

const s = (id: string, sets: number, lo: number, hi: number, rest?: number, rir?: number): SlotSpec => ({ id, sets, reps: [lo, hi], rest, rir });
/** Slot with a coaching note (EN / JA). */
const n = (id: string, sets: number, lo: number, hi: number, en: string, ja: string, rest?: number): SlotSpec => ({ ...s(id, sets, lo, hi, rest), note: { en, ja } });

const SQUAT = "Barbell_Squat", BENCH = "Barbell_Bench_Press_-_Medium_Grip", ROW = "Seated_Cable_Rows", DBP = "Dumbbell_Shoulder_Press";
const FB: SessionSpec[] = [
  { name: { en: "Full Body A", ja: "全身 A" }, slots: [s(SQUAT, 3, 5, 8, 180), s(BENCH, 3, 6, 10, 150), s(ROW, 3, 8, 12), s(DBP, 2, 8, 12), s("Lying_Leg_Curls", 2, 10, 15), s("Triceps_Pushdown", 2, 10, 15), s("Cable_Crunch", 2, 10, 15)] },
  { name: { en: "Full Body B", ja: "全身 B" }, slots: [s("Romanian_Deadlift", 3, 6, 10, 180), s("Incline_Dumbbell_Press", 3, 8, 12), s("Wide-Grip_Lat_Pulldown", 3, 8, 12), s("Leg_Press", 3, 10, 15, 120), s("Side_Lateral_Raise", 3, 12, 20), s("Dumbbell_Bicep_Curl", 2, 10, 15), s("Standing_Calf_Raises", 3, 10, 15)] },
  { name: { en: "Full Body C", ja: "全身 C" }, slots: [s("Hack_Squat", 3, 6, 10, 150), s("Dumbbell_Bench_Press", 3, 8, 12), s("One-Arm_Dumbbell_Row", 3, 8, 12), s("Face_Pull", 3, 12, 20), s("Seated_Leg_Curl", 3, 10, 15), s("Hammer_Curls", 2, 10, 15), s("Hanging_Leg_Raise", 2, 8, 15)] },
];

const UPPER_A: SessionSpec = { name: { en: "Upper A", ja: "上半身 A" }, slots: [s(BENCH, 3, 6, 10, 150), s("Bent_Over_Barbell_Row", 3, 6, 10, 150), s("Machine_Shoulder_Military_Press", 3, 8, 12), s("Wide-Grip_Lat_Pulldown", 3, 8, 12), s("Triceps_Pushdown", 3, 10, 15), s("Dumbbell_Bicep_Curl", 3, 10, 15)] };
const LOWER_A: SessionSpec = { name: { en: "Lower A", ja: "下半身 A" }, slots: [s(SQUAT, 3, 5, 8, 180), s("Romanian_Deadlift", 3, 6, 10, 150), s("Leg_Press", 2, 10, 15, 120), s("Lying_Leg_Curls", 3, 10, 15), s("Standing_Calf_Raises", 4, 10, 15), s("Cable_Crunch", 3, 10, 15)] };
const UPPER_B: SessionSpec = { name: { en: "Upper B", ja: "上半身 B" }, slots: [s("Incline_Dumbbell_Press", 3, 8, 12), s("Seated_Cable_Rows", 3, 8, 12), s(DBP, 3, 8, 12), s("Pullups", 3, 6, 10, 150), s("Side_Lateral_Raise", 3, 12, 20), s("EZ-Bar_Curl", 3, 10, 15), s("Standing_Dumbbell_Triceps_Extension", 3, 10, 15)] };
const LOWER_B: SessionSpec = { name: { en: "Lower B", ja: "下半身 B" }, slots: [s("Hack_Squat", 3, 6, 10, 150), s("Stiff-Legged_Barbell_Deadlift", 3, 6, 10, 150), s("Dumbbell_Lunges", 3, 8, 12), s("Seated_Leg_Curl", 3, 10, 15), s("Leg_Extensions", 3, 10, 15), s("Seated_Calf_Raise", 4, 10, 15)] };

const PUSH_A: SessionSpec = { name: { en: "Push A", ja: "プッシュ A" }, slots: [s(BENCH, 3, 6, 10, 150), s("Machine_Shoulder_Military_Press", 3, 8, 12), s("Incline_Dumbbell_Press", 2, 8, 12), s("Side_Lateral_Raise", 3, 12, 20), s("Triceps_Pushdown", 3, 10, 15), s("Standing_Dumbbell_Triceps_Extension", 2, 10, 15)] };
const PULL_A: SessionSpec = { name: { en: "Pull A", ja: "プル A" }, slots: [s("Wide-Grip_Lat_Pulldown", 3, 8, 12), s("Bent_Over_Barbell_Row", 3, 6, 10, 150), s(ROW, 2, 8, 12), s("Face_Pull", 3, 12, 20), s("Dumbbell_Bicep_Curl", 3, 10, 15), s("Hammer_Curls", 2, 10, 15)] };
const LEGS_A: SessionSpec = { name: { en: "Legs A", ja: "レッグ A" }, slots: [s(SQUAT, 3, 5, 8, 180), s("Romanian_Deadlift", 3, 6, 10, 150), s("Leg_Press", 2, 10, 15, 120), s("Lying_Leg_Curls", 3, 10, 15), s("Standing_Calf_Raises", 4, 10, 15), s("Hanging_Leg_Raise", 3, 8, 15)] };
const PUSH_B: SessionSpec = { name: { en: "Push B", ja: "プッシュ B" }, slots: [s(DBP, 3, 8, 12), s("Dumbbell_Bench_Press", 3, 8, 12), s("Cable_Crossover", 3, 12, 15), s("Side_Lateral_Raise", 3, 12, 20), s("Triceps_Pushdown_-_Rope_Attachment", 3, 10, 15), s("Dips_-_Triceps_Version", 2, 8, 15)] };
const PULL_B: SessionSpec = { name: { en: "Pull B", ja: "プル B" }, slots: [s("Pullups", 3, 6, 10, 150), s("One-Arm_Dumbbell_Row", 3, 8, 12), s("Close-Grip_Front_Lat_Pulldown", 2, 8, 12), s("Reverse_Flyes", 3, 12, 20), s("Preacher_Curl", 3, 10, 15), s("Incline_Dumbbell_Curl", 2, 10, 15)] };
const LEGS_B: SessionSpec = { name: { en: "Legs B", ja: "レッグ B" }, slots: [s("Hack_Squat", 3, 6, 10, 150), s("Barbell_Hip_Thrust", 3, 8, 12, 150), s("x-bulgarian-split-squat", 2, 8, 12), s("Seated_Leg_Curl", 3, 10, 15), s("Leg_Extensions", 3, 10, 15), s("Seated_Calf_Raise", 4, 10, 15)] };

const BRO: SessionSpec[] = [
  { name: { en: "Chest", ja: "胸" }, slots: [s(BENCH, 4, 6, 10, 150), s("Incline_Dumbbell_Press", 3, 8, 12), s("Leverage_Chest_Press", 3, 8, 12), s("Cable_Crossover", 3, 12, 15), s("Dips_-_Chest_Version", 2, 8, 15)] },
  { name: { en: "Back", ja: "背中" }, slots: [s("Wide-Grip_Lat_Pulldown", 4, 8, 12), s("Bent_Over_Barbell_Row", 3, 6, 10, 150), s(ROW, 3, 8, 12), s("One-Arm_Dumbbell_Row", 3, 8, 12), s("Straight-Arm_Pulldown", 3, 12, 15)] },
  { name: { en: "Shoulders", ja: "肩" }, slots: [s("Machine_Shoulder_Military_Press", 4, 8, 12), s("Side_Lateral_Raise", 4, 12, 20), s("Reverse_Flyes", 3, 12, 20), s("Face_Pull", 3, 12, 20), s("Dumbbell_Shrug", 3, 10, 15)] },
  { name: { en: "Legs", ja: "脚" }, slots: [s(SQUAT, 4, 5, 8, 180), s("Romanian_Deadlift", 3, 6, 10, 150), s("Leg_Press", 3, 10, 15, 120), s("Lying_Leg_Curls", 3, 10, 15), s("Leg_Extensions", 3, 10, 15), s("Standing_Calf_Raises", 4, 10, 15)] },
  { name: { en: "Arms", ja: "腕" }, slots: [s("EZ-Bar_Curl", 3, 8, 12), s("Triceps_Pushdown", 3, 8, 12), s("Incline_Dumbbell_Curl", 3, 10, 15), s("EZ-Bar_Skullcrusher", 3, 10, 15), s("Hammer_Curls", 2, 10, 15), s("Triceps_Pushdown_-_Rope_Attachment", 2, 12, 15)] },
];

const HOME: SessionSpec[] = [
  { name: { en: "Home Upper A", ja: "自宅 上半身 A" }, slots: [s("Dumbbell_Floor_Press", 3, 8, 12), s("One-Arm_Dumbbell_Row", 3, 8, 12), s(DBP, 3, 8, 12), s("x-band-face-pull", 3, 12, 20), s("Dumbbell_Bicep_Curl", 3, 10, 15), s("Standing_Dumbbell_Triceps_Extension", 3, 10, 15)] },
  { name: { en: "Home Lower A", ja: "自宅 下半身 A" }, slots: [s("Goblet_Squat", 3, 8, 12), s("x-dumbbell-romanian-deadlift", 3, 8, 12), s("Split_Squat_with_Dumbbells", 2, 8, 12), s("Single_Leg_Glute_Bridge", 3, 10, 15), s("Standing_Dumbbell_Calf_Raise", 4, 12, 20), s("Plank", 3, 30, 60, 60)] },
  { name: { en: "Home Upper B", ja: "自宅 上半身 B" }, slots: [s("Pushups", 3, 8, 20), s("x-band-row", 3, 10, 15), s("Lateral_Raise_-_With_Bands", 3, 12, 20), s("Reverse_Flyes", 3, 12, 20), s("x-band-curl", 3, 10, 15), s("x-band-pushdown", 3, 10, 15)] },
  { name: { en: "Home Lower B", ja: "自宅 下半身 B" }, slots: [s("Dumbbell_Squat", 3, 10, 15), s("Dumbbell_Lunges", 3, 8, 12), s("x-band-squat", 2, 12, 20), s("x-bodyweight-glute-bridge", 3, 12, 20), s("Standing_Dumbbell_Calf_Raise", 4, 12, 20), s("Crunches", 3, 10, 20)] },
];

// A user-contributed 4-day plan: one focus per day, warm-up and optional finishers kept as notes.
const EXAMPLE_4: SessionSpec[] = [
  { name: { en: "Glutes & Hams", ja: "お尻・ハムストリングス" }, slots: [
    n("Smith_Machine_Stiff-Legged_Deadlift", 3, 10, 12, "Warm up ~10 min first: treadmill walk or upright bike, glute bridges, banded walks. Controlled tempo (3 s down).", "最初に約10分ウォームアップ：トレッドミル歩行かアップライトバイク、グルートブリッジ、バンドウォーク。下ろす動作は3秒でコントロール。", 150),
    n("x-glute-extension-machine", 3, 12, 15, "Focus on the contraction.", "収縮を意識する。"),
    n("Seated_Leg_Curl", 3, 12, 15, "Squeeze at the top. Lying curl works too.", "トップで絞る。ライイングでも可。"),
    n("Leg_Press", 2, 10, 12, "High feet; keep tension on the glutes.", "足を高めに置き、お尻の緊張を保つ。", 120),
    n("Standing_Calf_Raises", 2, 15, 15, "Full stretch. Seated is fine. Optional finisher: stair stepper 10-15 min, moderate pace.", "しっかり伸ばす。シーテッドでも可。任意のフィニッシャー：ステアステッパー10〜15分、中程度のペース。"),
  ] },
  { name: { en: "Chest & Arms", ja: "胸・腕" }, slots: [
    n("Smith_Machine_Bench_Press", 3, 8, 10, "Warm up ~10 min first: banded chest fly, light curls and extensions. Leave 1-2 RIR.", "最初に約10分ウォームアップ：バンドチェストフライ、軽いカールとエクステンション。余力1〜2回を残す。", 150),
    n("Leverage_Chest_Press", 3, 10, 12, "Emphasize the stretch. Pec deck works too.", "ストレッチを強調。ペックデックでも可。"),
    n("Machine_Bicep_Curl", 2, 12, 15, "Slow tempo.", "ゆっくりしたテンポ。"),
    n("Triceps_Pushdown_-_Rope_Attachment", 2, 12, 15, "Elbows tucked.", "肘を体に寄せる。"),
    n("Incline_Dumbbell_Curl", 2, 10, 15, "Focus on the long head.", "長頭を意識する。"),
    n("Dips_-_Triceps_Version", 1, 6, 15, "Optional, only if energy is good: as many reps as possible.", "任意。余力があるときだけ：できるだけ多く。"),
  ] },
  { name: { en: "Quads", ja: "大腿四頭筋" }, slots: [
    n("Leg_Extensions", 3, 15, 15, "Warm up ~10 min first: light cycling, bodyweight squats, light leg extensions. Activation first.", "最初に約10分ウォームアップ：軽いバイク、自重スクワット、軽いレッグエクステンション。まず筋肉を目覚めさせる。"),
    n("Leg_Press", 3, 10, 12, "Medium stance. Steady breathing.", "足幅は中くらい。呼吸を一定に。", 120),
    n("x-bulgarian-split-squat", 2, 10, 10, "Dumbbells 12-16 kg. Use the bench for balance.", "ダンベル12〜16kg。ベンチでバランスをとる。"),
    n("Hack_Squat", 2, 8, 10, "Hack or Smith squat. Only if not dizzy.", "ハックかスミスのスクワット。ふらつかないときだけ。", 150),
    n("Calf_Press_On_The_Leg_Press_Machine", 2, 15, 20, "Slow and controlled.", "ゆっくりコントロールして。"),
  ] },
  { name: { en: "Back & Shoulders", ja: "背中・肩" }, slots: [
    n("Wide-Grip_Lat_Pulldown", 3, 10, 12, "Warm up ~10 min first: band pull-aparts, light pulldowns. Full stretch and squeeze.", "最初に約10分ウォームアップ：バンドプルアパート、軽いプルダウン。しっかり伸ばして絞る。"),
    n("Seated_Cable_Rows", 3, 10, 12, "Neutral grip.", "ニュートラルグリップ。"),
    n("Smith_Machine_Stiff-Legged_Deadlift", 2, 8, 10, "Optional: only if energy is OK.", "任意：余力があるときだけ。", 150),
    n("x-machine-lateral-raise", 3, 12, 15, "Pause at the top.", "トップで一瞬止める。"),
    n("x-pec-dec-rear-delt", 2, 12, 15, "Machine or cable. Keep the shoulders down.", "マシンかケーブル。肩を下げたまま。"),
    n("Dumbbell_Shoulder_Press", 2, 8, 10, "Optional: if recovered.", "任意：回復していれば。"),
  ] },
];

export const TEMPLATES: TemplateSpec[] = [
  { id: "full-body-3", name: { en: "Full body 3×", ja: "全身 週3回" }, blurb: { en: "Three whole-body sessions: the simplest way to start.", ja: "全身を週3回。始めるのに最も簡単な構成です。" }, daysPerWeek: 3, week: [0, null, 1, null, 2, null, null], sessions: FB },
  { id: "upper-lower-4", name: { en: "Upper / Lower 4×", ja: "上半身／下半身 週4回" }, blurb: { en: "Two upper and two lower days; a balanced classic.", ja: "上半身2日、下半身2日。バランスの良い定番です。" }, daysPerWeek: 4, week: [0, 1, null, 2, 3, null, null], sessions: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  { id: "ppl-6", name: { en: "Push / Pull / Legs 6×", ja: "プッシュ／プル／レッグ 週6回" }, blurb: { en: "Six days, each muscle twice a week. For experienced lifters.", ja: "週6日、各部位を週2回。経験者向けです。" }, daysPerWeek: 6, week: [0, 1, 2, 3, 4, 5, null], sessions: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B] },
  { id: "bro-5", name: { en: "Bro split 5×", ja: "部位別 週5回" }, blurb: { en: "One muscle group per day: chest, back, shoulders, legs, arms.", ja: "1日1部位：胸、背中、肩、脚、腕。" }, daysPerWeek: 5, week: [0, 1, 2, 3, 4, null, null], sessions: BRO },
  { id: "home-4", name: { en: "Home dumbbells + bands", ja: "自宅（ダンベル＋バンド）" }, blurb: { en: "Four sessions with dumbbells, bands and bodyweight only.", ja: "ダンベル、バンド、自重だけで行う週4回の構成です。" }, daysPerWeek: 4, week: [0, 1, null, 2, 3, null, null], sessions: HOME },
  { id: "example-4", name: { en: "Example: 4-day focus split", ja: "例：週4回 部位集中" }, blurb: { en: "Glutes & hams Tue, chest & arms Wed, quads Fri, back & shoulders Sun. Machine-friendly, with warm-up notes.", ja: "火：お尻・ハム、水：胸・腕、金：大腿四頭筋、日：背中・肩。マシン中心でウォームアップのメモ付き。" }, daysPerWeek: 4, week: [null, 0, 1, null, 2, null, 3], sessions: EXAMPLE_4 },
  { id: "blank", name: { en: "Blank", ja: "空のプログラム" }, blurb: { en: "Start empty and build your own sessions.", ja: "空の状態から自分でセッションを作ります。" }, daysPerWeek: 0, week: [null, null, null, null, null, null, null], sessions: [] },
];

export const exerciseIdsInTemplates = (): string[] => [...new Set(TEMPLATES.flatMap(t => t.sessions.flatMap(x => x.slots.map(y => y.id))))];

export const defaultRest = (isCompound: boolean) => (isCompound ? 150 : 90);

export function newSlot(exerciseId: string, isCompound: boolean): ExerciseSlot {
  return {
    id: newId(), exerciseId, sets: 3, repMin: isCompound ? 6 : 10, repMax: isCompound ? 10 : 15,
    rir: 2, restSec: defaultRest(isCompound), notes: "", supersetGroup: null,
  };
}

/** Editable copy of a template, named in the user's language. `todayKey` anchors week 1 to the current week. */
export function instantiateTemplate(spec: TemplateSpec, lang: Lang, todayKey: string): Omit<Program, "id" | "createdAt" | "updatedAt" | "schemaVersion"> {
  const sessions: SessionTemplate[] = spec.sessions.map(sess => ({
    id: newId(),
    name: sess.name[lang],
    exercises: sess.slots.map(sl => ({
      id: newId(), exerciseId: sl.id, sets: sl.sets, repMin: sl.reps[0], repMax: sl.reps[1],
      rir: sl.rir ?? 2, restSec: sl.rest ?? (sl.sets >= 3 && sl.reps[1] <= 10 ? 150 : 90), notes: sl.note?.[lang] ?? "", supersetGroup: null,
    })),
  }));
  return {
    name: spec.name[lang],
    active: true,
    templateId: spec.id,
    sessions,
    week: spec.week.map(i => (i === null ? null : sessions[i].id)),
    accumulationWeeks: spec.accumulationWeeks ?? 5,
    mesoStartDayKey: weekStart(todayKey),
  };
}

/** The template that fits a profile best: equipment first, then training days, then experience. */
export function recommendTemplate(p: { equipment: "home" | "bands" | "dumbbells" | "gym"; daysPerWeek: number; experience: "beginner" | "intermediate" | "advanced" }): string {
  if (p.equipment !== "gym") return "home-4";
  if (p.daysPerWeek <= 3) return "full-body-3";
  if (p.daysPerWeek === 4 || p.experience === "beginner") return "upper-lower-4";
  if (p.daysPerWeek === 5) return "bro-5";
  return "ppl-6";
}
