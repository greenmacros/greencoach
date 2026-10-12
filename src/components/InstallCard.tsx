import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import { installMode, onInstallChange, promptInstall } from "../install";
import Icon from "./Icon";

const DISMISS_KEY = "gc_install_dismissed";
const dismissedBefore = () => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };

/**
 * "Install GreenCoach" — a real Install button where the browser supports it (Android Chrome & co.), the two Share-menu
 * steps on iPhone/iPad, nothing when already installed or when the browser cannot install.
 * `dismissible`: the Workout-tab card can be closed for good; the Settings card always shows.
 */
export default function InstallCard({ dismissible = false }: { dismissible?: boolean }) {
  const { t } = useApp();
  const [mode, setMode] = useState(installMode());
  const [hidden, setHidden] = useState(dismissible && dismissedBefore());
  useEffect(() => onInstallChange(() => setMode(installMode())), []);
  if (hidden || mode === "installed" || mode === "none") return null;

  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ } };
  return (
    <div className="card grid gap-2" role="region" aria-label={t("install.title")}>
      <div className="flex items-start gap-2">
        <div className="flex-1"><p className="font-bold">{t("install.title")}</p><p className="muted text-sm">{t("install.why")}</p></div>
        {dismissible && <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={t("install.later")} onClick={dismiss}><Icon name="close" /></button>}
      </div>
      {mode === "prompt" ? (
        <button className="btn btn-primary justify-self-start" onClick={() => void promptInstall()}><Icon name="addBox" /> {t("install.button")}</button>
      ) : (
        <ol className="grid gap-1.5 text-sm">
          <li className="flex items-center gap-2"><span className="chip" style={{ cursor: "default", minHeight: 28, padding: "0 8px" }}>1</span>{t("install.ios1")} <Icon name="share" label={t("install.shareIcon")} style={{ color: "var(--accent)" }} /></li>
          <li className="flex items-center gap-2"><span className="chip" style={{ cursor: "default", minHeight: 28, padding: "0 8px" }}>2</span>{t("install.ios2")} <Icon name="addBox" style={{ color: "var(--accent)" }} /></li>
          <li className="muted text-xs">{t("install.iosNote")}</li>
        </ol>
      )}
    </div>
  );
}
