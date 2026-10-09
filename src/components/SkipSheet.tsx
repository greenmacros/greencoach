import { useState } from "react";
import { useApp } from "../app-context";
import { SKIP_REASONS, type SkipReason } from "../workout/types";

/** Asks why a set or an exercise is skipped, in the same one-tap grid as the feedback sheet. */
export default function SkipSheet({ title, onSkip, onCancel }: { title: string; onSkip: (r: SkipReason) => void; onCancel: () => void }) {
  const { t } = useApp();
  const [reason, setReason] = useState<SkipReason | null>(null);
  return (
    <div className="sheet" onClick={onCancel}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div><h2 className="text-xl font-bold">{title}</h2><p className="muted text-sm">{t("skip.why")}</p></div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("skip.why")}>
          {SKIP_REASONS.map(r => (
            <button key={r} type="button" className="btn" aria-pressed={reason === r} onClick={() => setReason(r)}
              style={{ minHeight: 52, ...(reason === r ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "transparent" } : {}) }}>
              {t(`skip.r.${r}`)}
            </button>
          ))}
        </div>
        {reason === "pain" && <p className="text-sm muted">{t("skip.painNote")}</p>}
        {reason === "dizzy" && <p className="text-sm" style={{ color: "var(--danger)" }}>{t("skip.dizzyNote")}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={onCancel}>{t("share.cancel")}</button>
          <button className="btn btn-primary" disabled={!reason} onClick={() => reason && onSkip(reason)}>{t("skip.confirm")}</button>
        </div>
      </div>
    </div>
  );
}
