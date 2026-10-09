import type { Equipment } from "../db/types";
import type { EquipmentId, Exercise } from "./types";

/** Equipment the user can tick in "My equipment" (bodyweight and "other" are always available). */
export const PICKABLE: EquipmentId[] = ["dumbbell", "bench", "bands", "kettlebell", "pullup-bar", "dip-bars", "trx", "barbell", "ez-bar", "landmine", "smith", "cable", "machine"];
const ALWAYS: EquipmentId[] = ["bodyweight", "other"];

/** Quick starting lists for the four setups; the user then ticks exactly what they have. */
export const PRESETS: Record<Equipment, EquipmentId[]> = {
  gym: [...PICKABLE],
  dumbbells: ["dumbbell", "bench", "bands", "pullup-bar"],
  bands: ["bands"],
  home: [],
};

/** The user's available equipment: their own list when set, else the preset of their setup. */
export function myEquipment(p: { equipment: Equipment; myEquipment?: EquipmentId[] }): Set<EquipmentId> {
  return new Set<EquipmentId>([...ALWAYS, ...(p.myEquipment ?? PRESETS[p.equipment])]);
}

/** An exercise is doable when every piece of equipment it needs is available. */
export const canDo = (ex: Pick<Exercise, "equipment">, have: ReadonlySet<EquipmentId>) => ex.equipment.every(e => have.has(e));

/** The coarse setup implied by a list (used for template recommendations and the coach's swap pool). */
export function setupFor(list: readonly EquipmentId[]): Equipment {
  if (list.some(e => ["barbell", "smith", "cable", "machine"].includes(e))) return "gym";
  if (list.some(e => ["dumbbell", "kettlebell"].includes(e))) return "dumbbells";
  if (list.includes("bands")) return "bands";
  return "home";
}
