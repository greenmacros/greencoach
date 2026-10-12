import { useEffect, useState } from "react";
import { repo } from "../db";
import { useApp } from "../app-context";
import { formatDateTime } from "../lib/format";
import { GREENMACROS_URL, NUTRITION_KEY, nutritionCodeFrom, summarize, type NutritionPlan } from "../nutrition/nutrition";
import Icon from "./Icon";

/** Latest logged body weight (Progress → Body), else the one from setup. */
export function useLatestBodyKg(): number | null {
  const { profile, dataVersion } = useApp();
  const [kg, setKg] = useState<number | null>(profile.bodyWeightKg ?? null);
  useEffect(() => {
    let live = true;
    void repo.list("bodyMetrics").then(rows => {
      const w = rows.filter(r => typeof r.weightKg === "number").sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey))).at(-1);
      if (live) setKg((w?.weightKg as number | undefined) ?? profile.bodyWeightKg ?? null);
    });
    return () => { live = false; };
  }, [profile.bodyWeightKg, dataVersion]);
  return kg;
}

/** Daily averages of a planned week, as a compact table. */
function Summary({ n, bodyKg }: { n: NutritionPlan; bodyKg: number | null }) {
  const { t } = useApp();
  const s = summarize(n);
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("nut.kcal")}</dt><dd className="font-bold">{Math.round(s.kcal)} kcal</dd></div>
      <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("nut.protein")}</dt>
        <dd className="font-bold">{Math.round(s.protein)} g{bodyKg ? <span className="muted font-normal"> · {(s.protein / bodyKg).toFixed(1)} g/kg</span> : null}</dd></div>
      <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("nut.carbs")}</dt><dd className="font-bold">{Math.round(s.carbs)} g</dd></div>
      <div className="card" style={{ padding: 10 }}><dt className="muted text-xs">{t("nut.fat")}</dt><dd className="font-bold">{Math.round(s.fat)} g</dd></div>
      <p className="muted text-xs col-span-2">{t("nut.planned", { n: s.plannedDays })}</p>
    </dl>
  );
}

/** Shown when GreenCoach is opened from a GreenMacros link. */
export function NutritionImportSheet({ plan, onUse, onCancel }: { plan: NutritionPlan | "bad"; onUse: () => void; onCancel: () => void }) {
  const { t } = useApp();
  const bodyKg = useLatestBodyKg();
  return (
    <div className="sheet" onClick={onCancel}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("nut.importTitle")} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{t("nut.importTitle")}</h2>
        {plan === "bad" ? (
          <>
            <p role="alert">{t("nut.bad")}</p>
            <button className="btn justify-self-start" onClick={onCancel}>{t("auto.ok")}</button>
          </>
        ) : (
          <>
            <Summary n={plan} bodyKg={bodyKg} />
            <p className="muted text-sm">{t("nut.importHint")}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={onUse}>{t("nut.use")}</button>
              <button className="btn" onClick={onCancel}>{t("share.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Settings → Nutrition: what is linked, paste a new week, open GreenMacros, unlink. */
export function NutritionCard() {
  const { t, settings, update } = useApp();
  const bodyKg = useLatestBodyKg();
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const n = settings.nutrition ?? null;
  const open = () => {
    const code = nutritionCodeFrom(text.trim());
    if (!code) return setErr(true);
    setText("");
    location.hash = NUTRITION_KEY + code; // the app shows the import sheet
  };
  return (
    <div className="card grid gap-3" aria-labelledby="nut-h">
      <h2 id="nut-h" className="font-bold">{t("nut.title")}</h2>
      <p className="muted text-sm">{t("nut.hint")}</p>
      {n ? (
        <>
          <Summary n={n} bodyKg={bodyKg} />
          <p className="muted text-xs">{t("nut.sent", { when: formatDateTime(n.at, settings.lang) })}</p>
        </>
      ) : <p className="text-sm">{t("nut.none")}</p>}
      <label className="grid gap-1 text-sm"><span className="muted">{t("nut.paste")}</span>
        <textarea className="field" value={text} aria-invalid={err} placeholder="https://…#nutrition=…" onChange={e => { setText(e.target.value); setErr(false); }} />
      </label>
      {err && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{t("nut.notLink")}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={!text.trim()} onClick={open}>{t("share.open")}</button>
        <a className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }} href={GREENMACROS_URL} target="_blank" rel="noopener noreferrer"><Icon name="link" /> {t("nut.openGm")}</a>
        {n && <button className="btn btn-danger" onClick={() => void update({ nutrition: null })}>{t("nut.unlink")}</button>}
      </div>
    </div>
  );
}
