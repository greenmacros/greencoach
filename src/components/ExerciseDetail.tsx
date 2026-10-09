import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import { loadInstructions, type Steps } from "../library/data";
import { equipmentFor, substitutes } from "../library/search";
import type { LibraryApi } from "../library/useLibrary";
import type { Exercise } from "../library/types";
import ExerciseMedia from "./ExerciseMedia";
import ExerciseHistory from "./ExerciseHistory";
import { useHistory } from "../workout/useHistory";
import Icon from "./Icon";

interface Props {
  ex: Exercise;
  lib: LibraryApi;
  onClose: () => void;
  onOpen: (ex: Exercise) => void;
  /** Present when the library is used as a picker. */
  onPick?: (ex: Exercise) => void;
  onDelete?: (ex: Exercise) => void;
  equipmentLevel?: "home" | "bands" | "dumbbells" | "gym";
}

export default function ExerciseDetail({ ex, lib, onClose, onOpen, onPick, onDelete, equipmentLevel = "gym" }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [steps, setSteps] = useState<Steps | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const hist = useHistory();

  useEffect(() => {
    setSteps(null);
    if (!ex.custom) void loadInstructions(ex.id).then(setSteps);
  }, [ex.id, ex.custom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fav = lib.favorites.has(ex.id);
  const list = steps ? (lang === "ja" && steps.ja ? steps.ja : steps.en) : [];
  const swaps = showSwap ? substitutes(lib.all, ex, equipmentFor(equipmentLevel)) : [];
  const other = lang === "ja" ? ex.name.en : ex.name.ja;
  const chips = (ids: string[], prefix: string) => ids.map(i => t(`${prefix}.${i}`)).join(" · ");

  return (
    <>
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body" role="dialog" aria-modal="true" aria-label={ex.name[lang]} onClick={e => e.stopPropagation()}>
        <div className="flex gap-3 items-start">
          <ExerciseMedia ex={ex} size={112} lazy={false} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight">{ex.name[lang]}</h2>
            {other !== ex.name[lang] && <p className="muted text-sm">{other}</p>}
            <p className="text-sm mt-1">{chips(ex.primary, "muscle")}</p>
            {ex.secondary.length > 0 && <p className="muted text-sm">{chips(ex.secondary, "muscle")}</p>}
          </div>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}><Icon name="close" /></button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
          <div><dt className="muted">{t("lib.equipment")}</dt><dd>{chips(ex.equipment, "equip")}</dd></div>
          <div><dt className="muted">{t("lib.pattern")}</dt><dd>{t(`pattern.${ex.pattern}`)}</dd></div>
          <div><dt className="muted">{t("lib.mechanic")}</dt><dd>{ex.mechanic ? t(`lib.${ex.mechanic}`) : "–"}</dd></div>
          <div><dt className="muted">{t("lib.difficulty")}</dt><dd>{t(`lib.diff.${ex.difficulty}`)}</dd></div>
          <div className="col-span-2">
            <dt className="muted">{t("lib.fatigue")} <span className="text-xs">({t("lib.fatigueHint")})</span></dt>
            <dd aria-label={`${ex.fatigue}/5`}>{Array.from({ length: 5 }, (_, i) => <Icon key={i} name="circle" size="0.9em" style={{ opacity: i < ex.fatigue ? 1 : 0.25 }} />)}</dd>
          </div>
        </dl>

        {ex.joints.length > 0 && (
          <div className="card mt-4 text-sm">
            <p className="font-semibold mb-1">{t("lib.joints")}</p>
            <ul className="grid gap-1 pl-4 list-disc">{ex.joints.map(j => <li key={j}>{t(`joint.${j}`)}</li>)}</ul>
          </div>
        )}

        <h3 className="font-bold mt-4 mb-1">{t("lib.how")}</h3>
        {ex.custom ? (
          <p className="muted whitespace-pre-wrap">{ex.notes || t("lib.noSteps")}</p>
        ) : !steps ? (
          <p className="muted">…</p>
        ) : list.length === 0 ? (
          <p className="muted">{t("lib.noSteps")}</p>
        ) : (
          <>
            {lang === "ja" && !steps.ja && <p className="muted text-sm mb-1">{t("lib.noJa")}</p>}
            <ol className="grid gap-2 pl-5 list-decimal">{list.map((s, i) => <li key={i} lang={lang === "ja" && !steps.ja ? "en" : undefined}>{s}</li>)}</ol>
          </>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {onPick && <button className="btn btn-primary" onClick={() => onPick(ex)}>{t("lib.pick")}</button>}
          <button className="btn" aria-pressed={fav} onClick={() => void lib.toggleFavorite(ex.id)}><Icon name={fav ? "starFill" : "star"} /> {fav ? t("lib.unfav") : t("lib.fav")}</button>
          <button className="btn" onClick={() => setShowSwap(s => !s)}>{t("lib.swap")}</button>
          <button className="btn" onClick={() => setShowHist(true)}>{t("hist.viewHistory")}</button>
          {ex.custom && onDelete && <button className="btn btn-danger" onClick={() => onDelete(ex)}>{t("lib.delete")}</button>}
        </div>

        {showSwap && (
          <div className="mt-3 grid gap-2">
            {swaps.length === 0 ? <p className="muted">{t("lib.swapNone")}</p> : swaps.map(s => (
              <button key={s.id} className="card flex items-center gap-3 text-left cursor-pointer" onClick={() => onOpen(s)}>
                <ExerciseMedia ex={s} size={48} />
                <span className="flex-1"><span className="font-semibold">{s.name[lang]}</span><br /><span className="muted text-sm">{chips(s.equipment, "equip")}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    {showHist && <ExerciseHistory ex={ex} workouts={hist.finished} onClose={() => setShowHist(false)} />}
    </>
  );
}
