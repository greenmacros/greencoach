import { useApp } from "../app-context";
import type { LibraryApi } from "../library/useLibrary";
import type { SharedPlan } from "../program/share";

interface Props {
  plan: SharedPlan | "bad";
  lib: LibraryApi;
  busy: boolean;
  onImport: () => void;
  onCancel: () => void;
}

/** Shown when the app is opened from a shared-plan link. */
export default function ImportPlanSheet({ plan, lib, busy, onImport, onCancel }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  if (plan === "bad")
    return (
      <div className="sheet" onClick={onCancel}>
        <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("share.importTitle")} onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold">{t("share.importTitle")}</h2>
          <p role="alert">{t("share.bad")}</p>
          <button className="btn justify-self-start" onClick={onCancel}>{t("auto.ok")}</button>
        </div>
      </div>
    );

  const customIds = new Set((plan.c ?? []).map(c => c.id));
  const ids = plan.s.flatMap(s => s.e.map(e => e[0]));
  const missing = new Set(ids.filter(id => !customIds.has(id) && lib.ready && !lib.byId(id))).size;
  const days = plan.w.filter(x => x !== null).length;
  const name = (id: string) => {
    const c = plan.c?.find(x => x.id === id);
    return lib.byId(id)?.name[lang] ?? (c ? (lang === "ja" ? c.ja || c.en : c.en || c.ja) : id);
  };

  return (
    <div className="sheet" onClick={onCancel}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("share.importTitle")} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{t("share.importTitle")}</h2>
        <div>
          <p className="text-lg font-bold">{plan.n || "—"}</p>
          <p className="muted text-sm">{t("share.summary", { s: plan.s.length, d: days, w: plan.a })}</p>
        </div>
        <ul className="grid gap-2">
          {plan.s.map((s, i) => (
            <li key={i} className="card" style={{ padding: 12 }}>
              <p className="font-semibold">{s.n}</p>
              <p className="muted text-sm">{s.e.map(e => `${name(e[0])} ${e[1]}×${e[2] === e[3] ? e[2] : `${e[2]}-${e[3]}`}`).join(" · ")}</p>
            </li>
          ))}
        </ul>
        {(plan.c?.length ?? 0) > 0 && <p className="text-sm">{t("share.customs", { n: plan.c!.length })}</p>}
        {missing > 0 && <p className="text-sm" style={{ color: "var(--danger)" }}>{t("share.missing", { n: missing })}</p>}
        <p className="muted text-sm">{t("share.importHint")}</p>
        {inBrowserOnIos() && <p className="text-sm card" style={{ padding: 10 }}>{t("share.browserHint")}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={onImport}>{t("share.import")}</button>
          <button className="btn" onClick={onCancel}>{t("share.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/** iPhone/iPad Safari tab (not the home-screen app), where data is separate from the installed app. */
function inBrowserOnIos(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}
