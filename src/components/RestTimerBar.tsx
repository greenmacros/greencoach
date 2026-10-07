import { useRef, useState } from "react";
import { useApp } from "../app-context";
import { formatRest } from "../lib/format";
import type { RestTimer } from "../workout/useRestTimer";
import { PRESETS, parseDuration } from "../workout/timer";

interface Props {
  timer: RestTimer;
  /** Called when a duration is chosen, so the current exercise can remember it. */
  onChoose: (sec: number) => void;
}

/** Sticky bar docked at the bottom of the workout page (not a separate screen). */
export default function RestTimerBar({ timer, onChoose }: Props) {
  const { t } = useApp();
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const choose = (sec: number) => { timer.start(sec); onChoose(sec); };

  const submit = () => {
    const sec = parseDuration(text);
    if (sec === null) return setErr(true);
    timer.addRecent(sec);
    choose(sec);
    setCustom(false); setText(""); setErr(false);
  };

  const pressStart = (sec: number) => { held.current = false; hold.current = setTimeout(() => { held.current = true; timer.dropRecent(sec); }, 600); };
  const pressEnd = () => { if (hold.current) clearTimeout(hold.current); };

  const low = timer.active && !timer.paused && timer.remaining <= 10;

  return (
    <div role="region" aria-label={t("timer.title")} className="fixed inset-x-0 bottom-0 z-20 border-t"
      style={{ background: "var(--surface)", borderColor: timer.finished ? "var(--accent)" : "var(--border)", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto max-w-2xl px-3 pt-2 grid gap-2">
        <div className="flex items-center gap-2">
          {timer.active ? (
            <>
              <div className="flex-1 min-w-0">
                <p role="timer" aria-live="off" className="font-bold" style={{ fontSize: 28, lineHeight: 1, color: low ? "var(--danger)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {formatRest(timer.remaining)}
                </p>
                <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "var(--border)", marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${timer.progress * 100}%`, background: "var(--accent)", transition: "width 0.25s linear" }} />
                </div>
              </div>
              <button className="btn" style={{ minWidth: 48, padding: 0 }} aria-label={t("timer.minus")} onClick={() => timer.adjust(-15)}>−15</button>
              <button className="btn" style={{ minWidth: 48, padding: 0 }} aria-label={t("timer.plus")} onClick={() => timer.adjust(15)}>+15</button>
              <button className="btn" style={{ minWidth: 48, padding: 0 }} aria-label={timer.paused ? t("timer.resume") : t("timer.pause")} onClick={timer.paused ? timer.resume : timer.pause}>{timer.paused ? "▶" : "⏸"}</button>
              <button className="btn" onClick={timer.skip}>{t("timer.skip")}</button>
            </>
          ) : (
            <p className="muted flex-1" role="status">{timer.finished ? t("timer.done") : t("timer.idle")}</p>
          )}
        </div>
        {timer.finished && <p role="status" className="font-semibold" style={{ color: "var(--accent)" }}>{t("timer.done")}</p>}
        <div className="hscroll" role="group" aria-label={t("timer.title")}>
          {PRESETS.map(sec => <button key={sec} className="chip" onClick={() => choose(sec)}>{formatRest(sec)}</button>)}
          {timer.recent.map(sec => (
            <button key={sec} className="chip" aria-label={`${formatRest(sec)} (${t("timer.recentHint")})`}
              onPointerDown={() => pressStart(sec)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
              onContextMenu={e => e.preventDefault()}
              onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); timer.dropRecent(sec); } }}
              onClick={() => { if (held.current) { held.current = false; return; } choose(sec); }}>
              ★ {formatRest(sec)}
            </button>
          ))}
          <button className="chip" aria-expanded={custom} onClick={() => setCustom(c => !c)}>{t("timer.custom")}</button>
        </div>
        {custom && (
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
            <input className="field" autoFocus inputMode="numeric" placeholder="1:45" aria-label={t("timer.customPrompt")} value={text} aria-invalid={err}
              onChange={e => { setText(e.target.value); setErr(false); }} />
            <button className="btn btn-primary" type="submit">{t("timer.start")}</button>
          </form>
        )}
        {err && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{t("timer.invalid")}</p>}
      </div>
    </div>
  );
}
