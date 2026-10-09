import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-context";
import Icon, { type IconName } from "./Icon";

/** The quick tour: one idea per card. Keys live in messages.ts (tour.<id>.title / .body / .tip). */
const STEPS: { id: string; icon: IconName }[] = [
  { id: "today", icon: "play" },
  { id: "log", icon: "check" },
  { id: "feedback", icon: "note" },
  { id: "coach", icon: "triUp" },
  { id: "program", icon: "swap" },
  { id: "data", icon: "copy" },
];

export default function Tour({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  const go = (d: number) => setI(x => Math.min(STEPS.length - 1, Math.max(0, x + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet" style={{ zIndex: 55 }}>
      <div className="sheet-body grid gap-4" role="dialog" aria-modal="true" aria-label={t("tour.title")} aria-roledescription="carousel"
        onTouchStart={e => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
        <div className="flex items-center justify-between">
          <p className="muted text-sm">{t("tour.title")} · {i + 1}/{STEPS.length}</p>
          <button className="btn" style={{ border: 0, background: "transparent", color: "var(--muted)" }} onClick={onClose}>{t("tour.skip")}</button>
        </div>
        <div className="grid gap-3" role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${STEPS.length}`} aria-live="polite" style={{ minHeight: 260, alignContent: "start" }}>
          <span className="grid place-items-center" aria-hidden="true"
            style={{ width: 56, height: 56, borderRadius: 16, background: "color-mix(in srgb, var(--accent) 16%, var(--surface))", color: "var(--accent)" }}>
            <Icon name={s.icon} size={28} />
          </span>
          <h2 className="text-2xl font-bold">{t(`tour.${s.id}.title`)}</h2>
          <p>{t(`tour.${s.id}.body`)}</p>
          <p className="card text-sm" style={{ padding: 12 }}><span className="font-semibold">{t("tour.tip")}</span> {t(`tour.${s.id}.tip`)}</p>
        </div>
        <div className="flex justify-center gap-2" aria-hidden="true">
          {STEPS.map((x, j) => <span key={x.id} style={{ width: j === i ? 20 : 8, height: 8, borderRadius: 999, background: j === i ? "var(--accent)" : "var(--border)", transition: "width .2s" }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" disabled={i === 0} onClick={() => go(-1)}>{t("tour.back")}</button>
          <button className="btn btn-primary" onClick={() => (last ? onClose() : go(1))}>{last ? t("tour.done") : t("tour.next")}</button>
        </div>
      </div>
    </div>
  );
}
