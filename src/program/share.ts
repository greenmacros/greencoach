import { EQUIPMENT, MUSCLES, PATTERNS, type EquipmentId, type Exercise, type Muscle, type Pattern } from "../library/types";
import { newId } from "../lib/id";
import { weekStart } from "./schedule";
import type { Program } from "./types";

/**
 * A program packed into a link. It travels in the URL fragment (after "#"), which browsers never send to a server,
 * so sharing needs no account or backend. Only the plan is shared: no weights, history or photos.
 */
export interface SharedPlan {
  v: 1;
  /** Program name. */
  n: string;
  /** Accumulation weeks. */
  a: number;
  /** Monday..Sunday: session index or null. */
  w: (number | null)[];
  /** Sessions: name + exercises [exerciseId, sets, repMin, repMax, rir, restSec, notes, supersetGroup]. */
  s: { n: string; e: [string, number, number, number, number, number, string, number | null][] }[];
  /** Custom exercises used by the plan. */
  c?: SharedCustom[];
}

export interface SharedCustom {
  id: string; en: string; ja: string; p: Muscle[]; s: Muscle[]; eq: EquipmentId[]; pat: Pattern; m: "compound" | "isolation"; f: 1 | 2 | 3 | 4 | 5; notes: string;
}

export const SHARE_KEY = "plan=";

export function toShared(program: Program, lookup: (id: string) => Exercise | undefined): SharedPlan {
  const custom = new Map<string, SharedCustom>();
  const s = program.sessions.map(sess => ({
    n: sess.name,
    e: sess.exercises.map(x => {
      const ex = lookup(x.exerciseId);
      if (ex?.custom && !custom.has(ex.id))
        custom.set(ex.id, { id: ex.id, en: ex.name.en, ja: ex.name.ja, p: ex.primary, s: ex.secondary, eq: ex.equipment, pat: ex.pattern, m: ex.mechanic ?? "compound", f: ex.fatigue, notes: ex.notes ?? "" });
      return [x.exerciseId, x.sets, x.repMin, x.repMax, x.rir, x.restSec, x.notes, x.supersetGroup] as SharedPlan["s"][number]["e"][number];
    }),
  }));
  const w = program.week.map(id => { const i = program.sessions.findIndex(x => x.id === id); return i < 0 ? null : i; });
  return { v: 1, n: program.name, a: program.accumulationWeeks, w, s, ...(custom.size ? { c: [...custom.values()] } : {}) };
}

// ---- encoding: JSON → deflate (when the browser can) → base64url. First char: "z" compressed, "j" plain. ----

const b64url = (bytes: Uint8Array) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodePlan(plan: SharedPlan): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(plan));
  if (typeof CompressionStream === "undefined") return "j" + b64url(raw);
  return "z" + b64url(await pipe(raw, new CompressionStream("deflate-raw")));
}

const MAX_JSON = 200_000;

/** Decode and validate an untrusted shared plan. Throws Error("bad-plan") for anything unusable. */
export async function decodePlan(code: string): Promise<SharedPlan> {
  let json: string;
  try {
    const bytes = unb64url(code.slice(1));
    const raw = code[0] === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : code[0] === "j" ? bytes : null;
    if (!raw || raw.length > MAX_JSON) throw new Error();
    json = new TextDecoder().decode(raw);
  } catch { throw new Error("bad-plan"); }
  let d: unknown;
  try { d = JSON.parse(json); } catch { throw new Error("bad-plan"); }
  return validate(d);
}

const str = (x: unknown, max = 500) => (typeof x === "string" ? x.slice(0, max) : "");
const int = (x: unknown, lo: number, hi: number, dflt: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : dflt);
const oneOf = <T extends string>(x: unknown, all: readonly T[], dflt: T): T => (all.includes(x as T) ? (x as T) : dflt);
const listOf = <T extends string>(x: unknown, all: readonly T[]): T[] => (Array.isArray(x) ? x.filter((v): v is T => all.includes(v as T)) : []);

function validate(d: unknown): SharedPlan {
  const p = d as Partial<SharedPlan> | null;
  if (!p || typeof p !== "object" || p.v !== 1 || !Array.isArray(p.s) || !Array.isArray(p.w) || p.s.length > 14) throw new Error("bad-plan");
  const s = p.s.map(sess => {
    if (!sess || !Array.isArray(sess.e) || sess.e.length > 30) throw new Error("bad-plan");
    return {
      n: str(sess.n, 80),
      e: sess.e.map(x => {
        if (!Array.isArray(x) || typeof x[0] !== "string" || !x[0]) throw new Error("bad-plan");
        const lo = int(x[2], 1, 100, 8);
        return [str(x[0], 120), int(x[1], 1, 20, 3), lo, Math.max(lo, int(x[3], 1, 100, 12)), int(x[4], 0, 10, 2), int(x[5], 0, 900, 120), str(x[6]), x[7] === null || x[7] === undefined ? null : int(x[7], 0, 50, 0)] as SharedPlan["s"][number]["e"][number];
      }),
    };
  });
  const w = Array.from({ length: 7 }, (_, i) => { const v = p.w![i]; return typeof v === "number" && v >= 0 && v < s.length ? Math.floor(v) : null; });
  const c = Array.isArray(p.c) ? p.c.slice(0, 50).map(x => ({
    id: str(x?.id, 120), en: str(x?.en, 80), ja: str(x?.ja, 80), p: listOf(x?.p, MUSCLES), s: listOf(x?.s, MUSCLES), eq: listOf(x?.eq, EQUIPMENT),
    pat: oneOf(x?.pat, PATTERNS, "other"), m: oneOf(x?.m, ["compound", "isolation"] as const, "compound"), f: int(x?.f, 1, 5, 3) as SharedCustom["f"], notes: str(x?.notes, 2000),
  })).filter(x => x.id && (x.en || x.ja)) : undefined;
  return { v: 1, n: str(p.n, 80), a: int(p.a, 3, 8, 5), w, s, ...(c?.length ? { c } : {}) };
}

/** Build a new, editable program from a shared plan. `customIds` maps the sharer's custom exercise ids to new local ones. */
export function fromShared(plan: SharedPlan, todayKey: string, customIds: ReadonlyMap<string, string>): Omit<Program, "createdAt" | "updatedAt" | "schemaVersion"> {
  const sessions = plan.s.map(sess => ({
    id: newId(),
    name: sess.n,
    exercises: sess.e.map(([exerciseId, sets, repMin, repMax, rir, restSec, notes, supersetGroup]) => ({
      id: newId(), exerciseId: customIds.get(exerciseId) ?? exerciseId, sets, repMin, repMax, rir, restSec, notes, supersetGroup, weightKg: null,
    })),
  }));
  return {
    id: "prog:" + newId(), name: plan.n, active: true, templateId: null, sessions,
    week: plan.w.map(i => (i === null ? null : sessions[i]?.id ?? null)),
    accumulationWeeks: plan.a, mesoStartDayKey: weekStart(todayKey),
  };
}

/** The share code from a URL hash like "#plan=z...". */
export const codeFromHash = (hash: string): string | null => {
  const h = hash.replace(/^#/, "");
  return h.startsWith(SHARE_KEY) ? h.slice(SHARE_KEY.length) : null;
};

export const shareUrl = (code: string, base = location.origin + location.pathname) => `${base}#${SHARE_KEY}${code}`;
