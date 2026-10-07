import type { Exercise, IndexRow } from "./types";

let cache: Exercise[] | null = null;

const fromRow = (r: IndexRow): Exercise => ({
  id: r.id,
  name: { en: r.n, ja: r.j },
  primary: r.p,
  secondary: r.s,
  equipment: r.e,
  pattern: r.pat,
  mechanic: r.m === "c" ? "compound" : r.m === "i" ? "isolation" : null,
  difficulty: r.d,
  fatigue: r.f,
  category: r.cat,
  joints: r.jt,
  frames: r.img,
});

/** The bundled library (937 exercises). Loaded lazily so it stays out of the initial JS. */
export async function loadBundled(): Promise<Exercise[]> {
  if (!cache) {
    const rows = (await import("../data/library/index.json")).default as IndexRow[];
    cache = rows.map(fromRow);
  }
  return cache;
}

export type Steps = { en: string[]; ja: string[] | null };

/** Instructions are separate files, only fetched when an exercise is opened. */
export async function loadInstructions(id: string): Promise<Steps> {
  const [en, ja] = await Promise.all([
    import("../data/library/instructions.en.json").then(m => m.default as Record<string, string[]>),
    import("../data/library/instructions.ja.json").then(m => m.default as Record<string, string[]>),
  ]);
  return { en: en[id] ?? [], ja: ja[id] ?? null };
}

export const frameUrl = (id: string, frame: 0 | 1) => `${import.meta.env.BASE_URL}ex/${id}-${frame}.webp`;
