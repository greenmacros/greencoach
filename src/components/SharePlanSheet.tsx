import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import type { LibraryApi } from "../library/useLibrary";
import { encodePlan, shareUrl, toShared } from "../program/share";
import type { Program } from "../program/types";
import Icon from "./Icon";

/** Builds a link that carries the whole plan, with copy and native share. */
export default function SharePlanSheet({ program, lib, onClose }: { program: Program; lib: LibraryApi; onClose: () => void }) {
  const { t } = useApp();
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { void encodePlan(toShared(program, lib.byId)).then(c => setUrl(shareUrl(c))); }, [program, lib.byId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMsg(t("share.copied")); }
    catch { (document.getElementById("share-link") as HTMLInputElement | null)?.select(); }
  };
  const canShare = typeof navigator.share === "function";

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("share.title")} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <h2 className="text-xl font-bold flex-1">{t("share.title")}</h2>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}><Icon name="close" /></button>
        </div>
        <p className="font-semibold">{program.name}</p>
        <p className="muted text-sm">{t("share.hint")}</p>
        <input id="share-link" className="field" readOnly value={url} aria-label={t("share.linkLabel")} onFocus={e => e.currentTarget.select()} />
        <div className="flex flex-wrap gap-2">
          {canShare && <button className="btn btn-primary" disabled={!url} onClick={() => void navigator.share({ title: program.name, url }).catch(() => {})}>{t("share.native")}</button>}
          <button className={canShare ? "btn" : "btn btn-primary"} disabled={!url} onClick={() => void copy()}>{t("share.copy")}</button>
        </div>
        {msg && <p role="status" className="font-semibold">{msg}</p>}
      </div>
    </div>
  );
}
