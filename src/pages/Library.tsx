import { useMemo, useState } from "react";
import { useApp } from "../app-context";
import CustomExerciseForm from "../components/CustomExerciseForm";
import ExerciseDetail from "../components/ExerciseDetail";
import ExerciseMedia from "../components/ExerciseMedia";
import VirtualList from "../components/VirtualList";
import { emptyFilters, equipmentFor, searchExercises, type Filters } from "../library/search";
import { EQUIPMENT, MUSCLES, PATTERNS, type CustomExerciseRecord, type Exercise } from "../library/types";
import type { LibraryApi } from "../library/useLibrary";
import TextInput from "../components/TextInput";

const ROW = 76;

interface Props {
  lib: LibraryApi;
  /** When set, tapping "Add" in the detail sheet calls this (workout / program builder use). */
  onPick?: (ex: Exercise) => void;
  /** Height of the scrolling list. */
  listHeight?: string;
  equipmentLevel?: "home" | "bands" | "dumbbells" | "gym";
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

export default function Library({ lib, onPick, listHeight = "calc(100dvh - 22rem)", equipmentLevel = "gym" }: Props) {
  const { t, settings } = useApp();
  const lang = settings.lang;
  const [f, setF] = useState<Filters>(emptyFilters);
  const [open, setOpen] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [undo, setUndo] = useState<CustomExerciseRecord | null>(null);

  const results = useMemo(
    () => searchExercises(lib.all, f, { lang, favorites: lib.favorites, recent: lib.recent, available: onlyMine ? equipmentFor(equipmentLevel) : undefined }),
    [lib.all, lib.favorites, lib.recent, f, lang, onlyMine, equipmentLevel],
  );

  const activeCount = f.muscles.length + f.equipment.length + f.patterns.length + (f.favoritesOnly ? 1 : 0) + (onlyMine ? 1 : 0);

  const remove = async (ex: Exercise) => {
    const rec = await lib.removeCustom(ex.id);
    setOpen(null);
    if (rec) setUndo(rec);
  };

  if (!lib.ready) return <p className="muted" role="status">{t("lib.loading")}</p>;

  return (
    <section className="grid gap-3" aria-label={t("lib.title")}>
      <TextInput type="search" className="field" placeholder={t("lib.search")} aria-label={t("lib.search")} value={f.query}
        onValue={v => setF(x => ({ ...x, query: v }))} />

      <div className="hscroll" role="group" aria-label={t("lib.muscles")}>
        {MUSCLES.map(m => (
          <button key={m} className="chip" aria-pressed={f.muscles.includes(m)} onClick={() => setF({ ...f, muscles: toggle(f.muscles, m) })}>{t(`muscle.${m}`)}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="chip" aria-expanded={showFilters} onClick={() => setShowFilters(s => !s)}>
          {t("lib.filters")}{activeCount ? ` (${activeCount})` : ""}
        </button>
        <button className="chip" aria-pressed={f.favoritesOnly} onClick={() => setF({ ...f, favoritesOnly: !f.favoritesOnly })}>★ {t("lib.favorites")}</button>
        {activeCount > 0 && <button className="chip" onClick={() => { setF({ ...emptyFilters, query: f.query }); setOnlyMine(false); }}>{t("lib.clear")}</button>}
        <span className="muted text-sm ml-auto" role="status">{t("lib.count", { n: results.length })}</span>
      </div>

      {showFilters && (
        <div className="card grid gap-3">
          <fieldset><legend className="font-semibold mb-1">{t("lib.equipment")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map(e => <button key={e} className="chip" aria-pressed={f.equipment.includes(e)} onClick={() => setF({ ...f, equipment: toggle(f.equipment, e) })}>{t(`equip.${e}`)}</button>)}
            </div>
          </fieldset>
          <label className="grid gap-1"><span className="font-semibold">{t("lib.pattern")}</span>
            <select className="field" value={f.patterns[0] ?? ""} onChange={e => setF({ ...f, patterns: e.target.value ? [e.target.value as never] : [] })}>
              <option value="">{t("lib.anyPattern")}</option>
              {PATTERNS.map(p => <option key={p} value={p}>{t(`pattern.${p}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />{t("lib.myEquipment")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.includeNonStrength} onChange={e => setF({ ...f, includeNonStrength: e.target.checked })} />{t("lib.stretches")}</label>
        </div>
      )}

      {results.length === 0 ? (
        <p className="muted card">{t("lib.empty")}</p>
      ) : (
        <VirtualList items={results} rowHeight={ROW} height={listHeight} label={t("lib.title")} getKey={e => e.id}
          render={ex => (
            <button className="w-full h-full flex items-center gap-3 text-left bg-transparent border-0 border-b cursor-pointer px-1"
              style={{ borderBottom: "1px solid var(--border)", color: "var(--text)", font: "inherit" }} onClick={() => setOpen(ex)}>
              <ExerciseMedia ex={ex} size={60} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{lib.favorites.has(ex.id) ? "★ " : ""}{ex.name[lang]}{ex.custom ? ` · ${t("lib.custom")}` : ""}</span>
                <span className="block muted text-sm truncate">{ex.primary.map(m => t(`muscle.${m}`)).join(", ")} · {ex.equipment.map(e => t(`equip.${e}`)).join(", ")}</span>
              </span>
            </button>
          )} />
      )}

      <button className="btn" onClick={() => setCreating(true)}>＋ {t("lib.addCustom")}</button>
      <p className="muted text-xs">{t("lib.credit")}</p>

      {open && (
        <ExerciseDetail ex={open} lib={lib} equipmentLevel={equipmentLevel} onClose={() => setOpen(null)} onOpen={setOpen}
          onPick={onPick ? ex => { void lib.markUsed(ex.id); onPick(ex); setOpen(null); } : undefined}
          onDelete={remove} />
      )}
      {creating && (
        <CustomExerciseForm onCancel={() => setCreating(false)} onSave={async input => {
          const ex = await lib.saveCustom(input);
          setCreating(false);
          setOpen(ex);
        }} />
      )}
      {undo && (
        <div role="status" className="card flex items-center gap-3 fixed left-4 right-4 mx-auto max-w-xl" style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))", zIndex: 40 }}>
          <span className="flex-1">{t("lib.deleted")}</span>
          <button className="btn" onClick={async () => { await lib.restoreCustom(undo); setUndo(null); }}>{t("lib.undo")}</button>
          <button className="btn" aria-label={t("lib.close")} onClick={() => setUndo(null)}>✕</button>
        </div>
      )}
    </section>
  );
}
