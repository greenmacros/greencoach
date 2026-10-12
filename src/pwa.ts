import { registerSW } from "virtual:pwa-register";

/**
 * Service-worker updates. A new version is checked for at start, every 30 minutes and whenever the app comes back
 * to the foreground. It is applied right away unless a workout is in progress; then it waits until the workout
 * is finished or left, so the page never reloads mid-set.
 */
const CHECK_EVERY_MS = 30 * 60 * 1000;

let ready = false;
let busy = () => false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
const listeners = new Set<() => void>();

export const updateReady = () => ready;
export function onUpdateReady(fn: () => void) { listeners.add(fn); return () => void listeners.delete(fn); }
/** The app tells us whether reloading now would interrupt something (an active workout). */
export function setBusy(fn: () => boolean) { busy = fn; }

/** Apply a waiting update now (reloads the page). */
export function applyUpdate() { if (ready && apply) void apply(true); }

/** Apply a waiting update if nothing would be interrupted. */
export function applyUpdateIfIdle() { if (!busy()) applyUpdate(); }

/** Ask the server for a newer version; resolves true when one is ready to apply. */
export async function checkForUpdate(): Promise<boolean> {
  try { await registration?.update(); } catch { /* offline */ }
  // Give a found update a moment to install.
  for (let i = 0; i < 20 && !ready && (registration?.installing || registration?.waiting); i++) await new Promise(r => setTimeout(r, 150));
  return ready;
}

export function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach(fn => fn());
      applyUpdateIfIdle();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      setInterval(() => void reg.update().catch(() => {}), CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void reg.update().catch(() => {}); });
    },
  });
}
