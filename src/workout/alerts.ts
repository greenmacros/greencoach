/** Side effects for the rest timer. Each is best-effort: browsers differ, and iOS limits background work. */

let ctx: AudioContext | null = null;

/** Create/resume the AudioContext inside a user gesture (a set tick) so the end-of-rest beep is allowed later. */
export function primeAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* audio is optional */ }
}

export function beep(): void {
  try {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const [i, f] of [880, 1175, 880].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.18);
      o.stop(t0 + i * 0.18 + 0.16);
    }
  } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported (iOS) */ }
}

export const notificationsSupported = () => typeof Notification !== "undefined";

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!notificationsSupported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: "rest-timer", icon: "icon-192.png", silent: false } as NotificationOptions);
    else new Notification(title, { body, tag: "rest-timer" });
  } catch { /* ignore */ }
}

/** Keeps the screen on; returns a release function. Re-acquired by the caller after tab switches. */
export async function acquireWakeLock(): Promise<(() => void) | null> {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wl) return null;
    const lock = await wl.request("screen");
    return () => { void lock.release(); };
  } catch { return null; }
}
