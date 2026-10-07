import { createDexieRepository } from "./dexieRepository";

/** The app-wide repository. Swap this one line to change the storage backend. */
export const repo = createDexieRepository();

/** Ask the browser not to evict our data under storage pressure. Safe to call repeatedly. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
