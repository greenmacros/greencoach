import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import { loadInstructions, type Steps } from "../library/data";
import type { Exercise } from "../library/types";
import ExerciseMedia from "./ExerciseMedia";
import Icon from "./Icon";

/** Large demo plus target muscles, opened by tapping an exercise's picture during a workout. */
export default function ExercisePreview({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [steps, setSteps] = useState<Steps | null>(null);

  useEffect(() => { if (!ex.custom) void loadInstructions(ex.id).then(setSteps); }, [ex.id, ex.custom]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = ex.custom ? (ex.notes ? [ex.notes] : []) : steps ? (lang === "ja" && steps.ja ? steps.ja : steps.en) : [];
  const tag = (m: string, strong: boolean) => (
    <span key={m} className="chip" aria-pressed={strong} style={{ cursor: "default", minHeight: 30 }}>{t(`muscle.${m}`)}</span>
  );

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={ex.name[lang]} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <h2 className="text-xl font-bold leading-tight flex-1">{ex.name[lang]}</h2>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
          <ExerciseMedia ex={ex} size="100%" lazy={false} />
        </div>
        <div className="grid gap-1">
          <p className="muted text-xs font-bold uppercase">{t("wk.targetMuscles")}</p>
          <div className="flex flex-wrap gap-2">{ex.primary.map(m => tag(m, true))}</div>
        </div>
        {ex.secondary.length > 0 && (
          <div className="grid gap-1">
            <p className="muted text-xs font-bold uppercase">{t("wk.alsoWorks")}</p>
            <div className="flex flex-wrap gap-2">{ex.secondary.map(m => tag(m, false))}</div>
          </div>
        )}
        {list.length > 0 && (
          <details>
            <summary className="font-bold cursor-pointer" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>{t("lib.how")}</summary>
            <ol className="grid gap-2 pl-5 list-decimal">{list.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        )}
      </div>
    </div>
  );
}
