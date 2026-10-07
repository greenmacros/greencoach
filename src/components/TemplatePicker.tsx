import { useApp } from "../app-context";
import { useState } from "react";
import { TEMPLATES, type TemplateSpec } from "../program/templates";
import PasteLinkSheet from "./PasteLinkSheet";

export default function TemplatePicker({ onPick, onCancel }: { onPick: (t: TemplateSpec) => void | Promise<void>; onCancel?: () => void }) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [pasting, setPasting] = useState(false);
  return (
    <section className="grid gap-3" aria-label={t("prog.pick")}>
      <h2 className="text-xl font-bold">{t("prog.pick")}</h2>
      <p className="muted">{t("prog.pickBody")}</p>
      <button className="btn justify-self-start" onClick={() => setPasting(true)}>{t("share.importPaste")}</button>
      {pasting && <PasteLinkSheet onClose={() => setPasting(false)} />}
      {TEMPLATES.map(spec => (
        <article key={spec.id} className="card grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold">{spec.name[lang]}</h3>
            {spec.daysPerWeek > 0 && <span className="muted text-sm">{t("prog.days", { n: spec.daysPerWeek })}</span>}
          </div>
          <p className="muted text-sm">{spec.blurb[lang]}</p>
          {spec.sessions.length > 0 && <p className="text-sm">{spec.sessions.map(s => s.name[lang]).join(" · ")}</p>}
          <button className="btn btn-primary" onClick={() => void onPick(spec)}>{t("prog.use")}</button>
        </article>
      ))}
      {onCancel && <button className="btn" onClick={onCancel}>{t("lib.form.cancel")}</button>}
    </section>
  );
}
