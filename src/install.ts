/**
 * Installing the app to the home screen. Chrome / Edge / Samsung Internet (Android and desktop) fire
 * `beforeinstallprompt`, which lets the app show its own Install button. iOS has no such API: the user adds it from
 * the Share menu, so the app shows those two steps instead.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export function initInstall() {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e as PromptEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}

export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => void listeners.delete(fn); };

/** Already running from the home screen / as an installed app. */
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** How this browser installs: a native prompt, the iOS Share menu, or not at all (e.g. desktop Firefox). */
export function installMode(): "installed" | "prompt" | "ios" | "none" {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "none";
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  notify();
  return outcome === "accepted";
}
