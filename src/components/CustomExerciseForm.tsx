import { useState } from "react";
import { useApp } from "../app-context";
import { EQUIPMENT, MUSCLES, PATTERNS, type EquipmentId, type Muscle, type Pattern } from "../library/types";
import type { CustomExerciseRecord } from "../library/types";
import { compressImage as compressPhoto } from "../lib/image";
import TextInput from "./TextInput";

type Input = Omit<CustomExerciseRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion">;

export default function CustomExerciseForm({ onSave, onCancel }: { onSave: (i: Input) => void | Promise<void>; onCancel: () => void }) {
  const { t } = useApp();
  const [nameEn, setNameEn] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [primary, setPrimary] = useState<Muscle | "">("");
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [pattern, setPattern] = useState<Pattern>("other");
  const [mechanic, setMechanic] = useState<"compound" | "isolation">("compound");
  const [fatigue, setFatigue] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const submit = async () => {
    if (!nameEn.trim() && !nameJa.trim()) return setError(t("lib.form.nameHint"));
    if (!primary) return setError(t("lib.form.needMuscle"));
    if (!equipment.length) return setError(t("lib.form.needEquip"));
    await onSave({ nameEn: nameEn.trim(), nameJa: nameJa.trim(), primary: [primary], secondary: secondary.filter(m => m !== primary), equipment, pattern, mechanic, fatigue, notes: notes.trim(), photo });
  };

  return (
    <div className="sheet" onClick={onCancel}>
      <form className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={t("lib.addCustom")} onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); void submit(); }}>
        <h2 className="text-xl font-bold">{t("lib.addCustom")}</h2>
        <label className="grid gap-1">{t("lib.form.nameEn")}<TextInput className="field" value={nameEn} onValue={setNameEn} /></label>
        <label className="grid gap-1">{t("lib.form.nameJa")}<TextInput className="field" value={nameJa} onValue={setNameJa} /></label>

        <fieldset className="grid gap-1"><legend className="font-semibold mb-1">{t("lib.primary")}</legend>
          <div className="flex flex-wrap gap-1.5">{MUSCLES.map(m => <button type="button" key={m} className="chip" aria-pressed={primary === m} onClick={() => setPrimary(m)}>{t(`muscle.${m}`)}</button>)}</div>
        </fieldset>
        <fieldset className="grid gap-1"><legend className="font-semibold mb-1">{t("lib.secondary")}</legend>
          <div className="flex flex-wrap gap-1.5">{MUSCLES.filter(m => m !== primary).map(m => <button type="button" key={m} className="chip" aria-pressed={secondary.includes(m)} onClick={() => setSecondary(toggle(secondary, m))}>{t(`muscle.${m}`)}</button>)}</div>
        </fieldset>
        <fieldset className="grid gap-1"><legend className="font-semibold mb-1">{t("lib.equipment")}</legend>
          <div className="flex flex-wrap gap-1.5">{EQUIPMENT.map(e => <button type="button" key={e} className="chip" aria-pressed={equipment.includes(e)} onClick={() => setEquipment(toggle(equipment, e))}>{t(`equip.${e}`)}</button>)}</div>
        </fieldset>

        <label className="grid gap-1">{t("lib.pattern")}
          <select className="field" value={pattern} onChange={e => setPattern(e.target.value as Pattern)}>{PATTERNS.map(p => <option key={p} value={p}>{t(`pattern.${p}`)}</option>)}</select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">{t("lib.mechanic")}
            <select className="field" value={mechanic} onChange={e => setMechanic(e.target.value as "compound" | "isolation")}><option value="compound">{t("lib.compound")}</option><option value="isolation">{t("lib.isolation")}</option></select>
          </label>
          <label className="grid gap-1">{t("lib.fatigue")}
            <select className="field" value={fatigue} onChange={e => setFatigue(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
          </label>
        </div>
        <label className="grid gap-1">{t("lib.form.notes")}<TextInput multiline className="field" value={notes} onValue={setNotes} /></label>
        <label className="grid gap-1">{t("lib.form.photo")}
          <input type="file" accept="image/*" className="field" onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await compressPhoto(f)); }} />
        </label>
        {photo && <img src={photo} alt="" width={96} height={96} style={{ objectFit: "cover", borderRadius: 10 }} />}
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">{t("lib.form.save")}</button>
          <button type="button" className="btn" onClick={onCancel}>{t("lib.form.cancel")}</button>
        </div>
      </form>
    </div>
  );
}
