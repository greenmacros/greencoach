import { useRef, useState } from "react";
import { useApp } from "../app-context";
import { formatRest } from "../lib/format";
import type { RestTimer } from "../workout/useRestTimer";
import { PRESETS, parseDuration } from "../workout/timer";
import Icon from "./Icon";

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
        {timer.active ? (
          <div className="grid gap-2 justify-items-center">
            <p role="timer" aria-live="off" className="font-extrabold text-center"
              style={{ fontSize: 56, lineHeight: 1, letterSpacing: -1, color: low ? "var(--danger)" : "var(--accent)", fontVariantNumeric: "tabular-nums", opacity: timer.paused ? 0.6 : 1 }}>
              {formatRest(timer.remaining)}
            </p>
            <div aria-hidden="true" style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${timer.progress * 100}%`, background: low ? "var(--danger)" : "var(--accent)", transition: "width 0.25s linear" }} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button className="btn" style={{ minWidth: 56, padding: 0 }} aria-label={t("timer.minus")} onClick={() => timer.adjust(-15)}>−15</button>
              <button className="btn btn-primary" style={{ minWidth: 56, padding: 0 }} aria-label={timer.paused ? t("timer.resume") : t("timer.pause")} onClick={timer.paused ? timer.resume : timer.pause}><Icon name={timer.paused ? "play" : "pause"} size={22} /></button>
              <button className="btn" style={{ minWidth: 56, padding: 0 }} aria-label={t("timer.plus")} onClick={() => timer.adjust(15)}>+15</button>
              <button className="btn" onClick={timer.skip}>{t("timer.skip")}</button>
            </div>
          </div>
        ) : !timer.finished && (
          <p className="muted text-center" role="status">{t("timer.idle")}</p>
        )}
        {timer.finished && <p role="status" className="font-bold text-center" style={{ color: "var(--accent)", fontSize: 20 }}>{t("timer.done")}</p>}
        <div className="hscroll hscroll-center" role="group" aria-label={t("timer.title")}>
          {PRESETS.map(sec => <button key={sec} className="chip" onClick={() => choose(sec)}>{formatRest(sec)}</button>)}
          {timer.recent.map(sec => (
            <button key={sec} className="chip" aria-label={`${formatRest(sec)} (${t("timer.recentHint")})`}
              onPointerDown={() => pressStart(sec)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
              onContextMenu={e => e.preventDefault()}
              onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); timer.dropRecent(sec); } }}
              onClick={() => { if (held.current) { held.current = false; return; } choose(sec); }}>
              <Icon name="starFill" size="0.9em" /> {formatRest(sec)}
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
