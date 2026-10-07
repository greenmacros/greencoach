import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import { beep, notify, vibrate } from "./alerts";
import * as T from "./timer";

const KEY = "gc_timer";
const PRESET_ID = "rest-recent";

const load = (): T.TimerState => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as T.TimerState | null;
    // A rest that ended long ago while the app was closed is not worth resuming.
    return s && typeof s.totalSec === "number" && T.remainingMs(s, Date.now()) > 0 ? s : T.idle;
  } catch { return T.idle; }
};

export interface RestTimer {
  state: T.TimerState;
  now: number;
  remaining: number;
  active: boolean;
  paused: boolean;
  progress: number;
  /** True for a moment after a countdown finished. */
  finished: boolean;
  recent: number[];
  start: (sec: number) => void;
  pause: () => void;
  resume: () => void;
  adjust: (deltaSec: number) => void;
  skip: () => void;
  addRecent: (sec: number) => void;
  dropRecent: (sec: number) => void;
}

export function useRestTimer(alertText: { title: string; body: string }): RestTimer {
  const { settings } = useApp();
  const [state, setState] = useState<T.TimerState>(load);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [recent, setRecent] = useState<number[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const textRef = useRef(alertText);
  textRef.current = alertText;

  useEffect(() => { void repo.get("timerPresets", PRESET_ID).then(r => r && setRecent((r.times as number[]) ?? [])); }, []);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);

  const fire = useCallback(() => {
    setState(s => {
      if (!T.shouldAlert(s, Date.now())) return s;
      const st = settingsRef.current;
      if (st.restSound) beep();
      if (st.restVibrate) vibrate();
      if (st.restNotify && document.hidden) void notify(textRef.current.title, textRef.current.body);
      setFinished(true);
      return T.markAlerted(s);
    });
  }, []);

  // Fire at the right moment; recompute after the tab wakes because timeouts are throttled while hidden.
  useEffect(() => {
    if (state.endsAt === null || state.alerted) return;
    const id = setTimeout(fire, Math.max(0, state.endsAt - Date.now()));
    const onVis = () => { setNow(Date.now()); fire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(id); document.removeEventListener("visibilitychange", onVis); };
  }, [state.endsAt, state.alerted, fire]);

  // Display tick only while counting down.
  useEffect(() => {
    if (state.endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.endsAt]);

  useEffect(() => { if (!finished) return; const id = setTimeout(() => setFinished(false), 4000); return () => clearTimeout(id); }, [finished]);

  const persistRecent = useCallback((list: number[]) => {
    setRecent(list);
    void repo.put("timerPresets", { id: PRESET_ID, times: list });
  }, []);

  return {
    state, now,
    remaining: T.remainingSec(state, now),
    active: T.isActive(state),
    paused: T.isPaused(state),
    progress: T.progress(state, now),
    finished,
    recent,
    start: sec => { setFinished(false); setState(T.start(Date.now(), sec)); },
    pause: () => setState(s => T.pause(s, Date.now())),
    resume: () => setState(s => T.resume(s, Date.now())),
    adjust: d => setState(s => T.adjust(s, Date.now(), d)),
    skip: () => { setFinished(false); setState(T.skip()); },
    addRecent: sec => { if (!(T.PRESETS as readonly number[]).includes(sec)) persistRecent(T.pushRecent(recent, sec)); },
    dropRecent: sec => persistRecent(T.removeRecent(recent, sec)),
  };
}
