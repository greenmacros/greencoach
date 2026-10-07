import { useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import type { Equipment, Experience, Goal, Phase, Profile, WeightUnit } from "../db/types";
import { fromDisplayWeight } from "../lib/format";
import { newId } from "../lib/id";
import Seg from "../components/Seg";
import { TEMPLATES, recommendTemplate, type TemplateSpec } from "../program/templates";
import type { ProgramApi } from "../program/useProgram";

const STEPS = 4;
const phaseFor = (g: Goal): Phase => (g === "cut" ? "cut" : g === "muscle" ? "bulk" : "maintain");

/** First-run setup: preferences, optional body data, training profile, starting program. Everything is editable later. */
export default function Onboarding({ prog, onDone }: { prog: ProgramApi; onDone: () => void }) {
  const { t, settings, update, profile, updateProfile } = useApp();
  const [step, setStep] = useState(1);
  const [p, setP] = useState<Profile>(profile);
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");

  const finish = async (spec: TemplateSpec | null) => {
    const bw = parseFloat(weight.replace(",", "."));
    const bodyWeightKg = bw > 0 ? fromDisplayWeight(bw, settings.weightUnit) : undefined;
    await updateProfile({ ...p, age: parseInt(age) || undefined, heightCm: parseFloat(height) || undefined, bodyWeightKg });
    if (bodyWeightKg) await repo.put("bodyMetrics", { id: `bm:${newId()}`, dayKey: prog.todayKey, weightKg: bodyWeightKg } as never);
    if (spec) await prog.createFromTemplate(spec);
    await update({ onboarded: true });
    onDone();
  };

  const rec = TEMPLATES.find(x => x.id === recommendTemplate(p))!;
  const field = <K extends keyof Profile>(k: K, v: Profile[K]) => setP(prev => ({ ...prev, [k]: v }));

  return (
    <section className="grid gap-4" aria-label={t("ob.welcome")}>
      <div>
        <p className="muted text-sm">{t("ob.step", { n: step, m: STEPS })}</p>
        <div aria-hidden="true" style={{ height: 4, background: "var(--border)", borderRadius: 2 }}><div style={{ width: `${(step / STEPS) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} /></div>
      </div>

      {step === 1 && (
        <div className="grid gap-4">
          <h1 className="text-2xl font-bold">{t("ob.welcome")}</h1>
          <p>{t("ob.tagline")}</p>
          <p className="muted text-sm">{t("ob.free")}</p>
          <div className="card grid gap-3">
            <h2 className="font-bold">{t("ob.prefs")}</h2>
            <Seg label={t("settings.language")} value={settings.lang} onChange={v => void update({ lang: v })} options={[{ value: "en", label: "English" }, { value: "ja", label: "日本語" }]} />
            <Seg label={t("settings.weightUnit")} value={settings.weightUnit} onChange={(v: WeightUnit) => void update({ weightUnit: v })} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
            <Seg label={t("settings.theme")} value={settings.theme} onChange={v => void update({ theme: v })} options={(["system", "light", "dark"] as const).map(v => ({ value: v, label: t(`theme.${v}`) }))} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card grid gap-3">
          <h1 className="text-xl font-bold">{t("ob.about")}</h1>
          <p className="muted text-sm">{t("ob.aboutHint")}</p>
          <label className="grid gap-1"><span>{t("ob.sex")} <span className="muted text-sm">({t("ob.optional")})</span></span>
            <select className="field" value={p.sex ?? ""} onChange={e => field("sex", (e.target.value || undefined) as Profile["sex"])}>
              <option value="">{t("ob.sex.none")}</option>
              {(["male", "female", "other"] as const).map(s => <option key={s} value={s}>{t(`ob.sex.${s}`)}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm"><span>{t("ob.age")}</span><input className="field" inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span>{t("ob.weight", { u: settings.weightUnit })}</span><input className="field" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span>{t("ob.height")}</span><input className="field" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card grid gap-3">
          <h1 className="text-xl font-bold">{t("ob.training")}</h1>
          <label className="grid gap-1"><span>{t("profile.experience")}</span>
            <select className="field" value={p.experience} onChange={e => field("experience", e.target.value as Experience)}>
              {(["beginner", "intermediate", "advanced"] as const).map(o => <option key={o} value={o}>{t(`profile.exp.${o}`)}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span>{t("profile.goal")}</span>
            <select className="field" value={p.goal} onChange={e => { const g = e.target.value as Goal; setP(prev => ({ ...prev, goal: g, phase: phaseFor(g) })); }}>
              {(["muscle", "strength", "cut", "maintain", "recomp"] as const).map(o => <option key={o} value={o}>{t(`profile.goal.${o}`)}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span>{t("profile.phase")}</span>
            <select className="field" value={p.phase} onChange={e => field("phase", e.target.value as Phase)}>
              {(["bulk", "maintain", "cut"] as const).map(o => <option key={o} value={o}>{t(`profile.phase.${o}`)}</option>)}
            </select>
            <span className="muted text-xs">{t("ob.phaseHint")}</span>
          </label>
          <label className="grid gap-1"><span>{t("profile.days")}</span>
            <Seg label={t("profile.days")} value={p.daysPerWeek} onChange={v => field("daysPerWeek", v)} options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))} />
          </label>
          <label className="grid gap-1"><span>{t("profile.equipment")}</span>
            <select className="field" value={p.equipment} onChange={e => field("equipment", e.target.value as Equipment)}>
              {(["gym", "dumbbells", "bands", "home"] as const).map(o => <option key={o} value={o}>{t(`profile.eq.${o}`)}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span>{t("profile.region")}</span>
            <select className="field" value={settings.region} onChange={e => void update({ region: e.target.value as never })}>
              {(["JP", "north", "south"] as const).map(o => <option key={o} value={o}>{t(`profile.region.${o}`)}</option>)}
            </select>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3">
          <h1 className="text-xl font-bold">{t("ob.program")}</h1>
          <p className="font-semibold">{t("ob.recommended")}</p>
          <article className="card grid gap-2" style={{ borderColor: "var(--accent)" }} aria-label={rec.name[settings.lang]}>
            <h2 className="font-bold">{rec.name[settings.lang]}</h2>
            <p className="muted text-sm">{rec.blurb[settings.lang]}</p>
            <button className="btn btn-primary" onClick={() => void finish(rec)}>{t("ob.start")}</button>
          </article>
          <p className="font-semibold">{t("ob.others")}</p>
          {TEMPLATES.filter(x => x.id !== rec.id).map(spec => (
            <article key={spec.id} className="card grid gap-1" aria-label={spec.name[settings.lang]}>
              <div className="flex items-center gap-2">
                <div className="flex-1"><h2 className="font-bold">{spec.name[settings.lang]}</h2><p className="muted text-sm">{spec.blurb[settings.lang]}</p></div>
                <button className="btn" onClick={() => void finish(spec)}>{t("ob.start")}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {step > 1 && <button className="btn" onClick={() => setStep(s => s - 1)}>{t("ob.back")}</button>}
        {step < STEPS && <button className="btn btn-primary flex-1" onClick={() => setStep(s => s + 1)}>{t("ob.next")}</button>}
      </div>
      <button className="btn" style={{ border: 0, background: "transparent", color: "var(--muted)" }} onClick={() => void finish(null)}>{t("ob.skip")}</button>
    </section>
  );
}
