import { useState } from "react";
import { useApp } from "../app-context";
import { formatDateTime } from "../lib/format";
import Icon from "./Icon";

const POINTS = ["safety.p1", "safety.p2", "safety.p3", "safety.p4", "safety.p5"];

/** The safety text, shared by the one-time agreement and Settings → About & safety. */
export function SafetyText() {
  const { t } = useApp();
  return (
    <ul className="grid gap-2 text-sm">
      {POINTS.map((k, i) => (
        <li key={k} className="flex gap-2">
          <span style={{ color: i === 2 ? "var(--danger)" : "var(--muted)", paddingTop: 2 }}><Icon name={i === 2 ? "warn" : "info"} /></span>
          <span>{t(k)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shown once (and to existing users once) until the user confirms they have read it. */
export function SafetyGate() {
  const { t, update, settings } = useApp();
  const [ok, setOk] = useState(false);
  return (
    <div className="sheet" style={{ zIndex: 60, alignItems: "stretch" }}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-labelledby="safety-h"
        style={{ maxHeight: "none", borderRadius: 0, alignContent: "start", overflowY: "auto", paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        {/* Language first: the notice must be readable before it is agreed to. */}
        <div className="seg" role="group" aria-label="Language / 言語" style={{ maxWidth: 260 }}>
          {([["en", "English"], ["ja", "日本語"]] as const).map(([l, label]) => (
            <button key={l} lang={l} aria-pressed={settings.lang === l} onClick={() => void update({ lang: l })}>{label}</button>
          ))}
        </div>
        <h1 id="safety-h" className="text-2xl font-bold">{t("safety.title")}</h1>
        <SafetyText />
        <p className="muted text-sm">{t("safety.privacy")}</p>
        <label className="flex items-start gap-3 card" style={{ padding: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, flex: "none" }} />
          <span className="font-semibold">{t("safety.agree")}</span>
        </label>
        <button className="btn btn-primary" disabled={!ok} onClick={() => void update({ safetyAcceptedAt: new Date().toISOString() })}>{t("safety.continue")}</button>
      </div>
    </div>
  );
}

/** Settings card: the same text, when it was agreed, and the privacy note. */
export function SafetyCard() {
  const { t, settings } = useApp();
  return (
    <div className="card grid gap-2" aria-labelledby="safety-card-h">
      <h2 id="safety-card-h" className="font-bold">{t("safety.settings")}</h2>
      <SafetyText />
      <p className="muted text-sm">{t("safety.privacy")}</p>
      {settings.safetyAcceptedAt && <p className="muted text-xs">{t("safety.agreedOn", { when: formatDateTime(settings.safetyAcceptedAt, settings.lang) })}</p>}
    </div>
  );
}
