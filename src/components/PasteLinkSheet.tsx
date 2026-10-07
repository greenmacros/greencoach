import { useState } from "react";
import { useApp } from "../app-context";
import { SHARE_KEY } from "../program/share";

/** Paste a shared-plan link inside the app (needed on iPhone, where links open in Safari, not the home-screen app). */
export default function PasteLinkSheet({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const open = () => {
    const i = text.indexOf("#" + SHARE_KEY);
    const code = i >= 0 ? text.slice(i + 1 + SHARE_KEY.length).trim() : text.startsWith(SHARE_KEY) ? text.slice(SHARE_KEY.length).trim() : "";
    if (!code) return setErr(true);
    onClose();
    location.hash = SHARE_KEY + code; // the app listens for this and shows the import sheet
  };
  return (
    <div className="sheet" onClick={onClose}>
      <form className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("share.pasteTitle")} onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); open(); }}>
        <h2 className="text-xl font-bold">{t("share.pasteTitle")}</h2>
        <p className="muted text-sm">{t("share.pasteHint")}</p>
        <textarea className="field" autoFocus aria-label={t("share.linkLabel")} value={text} aria-invalid={err}
          onChange={e => { setText(e.target.value); setErr(false); }} placeholder="https://…#plan=…" />
        {err && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{t("share.notLink")}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={!text.trim()}>{t("share.open")}</button>
          <button className="btn" type="button" onClick={onClose}>{t("share.cancel")}</button>
        </div>
      </form>
    </div>
  );
}
