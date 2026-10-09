import { useApp } from "../app-context";
import type { Equipment, Profile } from "../db/types";
import { PICKABLE, PRESETS, myEquipment, setupFor } from "../library/equipment";
import type { EquipmentId } from "../library/types";
import { fmtWeight, fromDisplayWeight } from "../lib/format";
import Icon from "./Icon";
import NumInput from "./NumInput";

type Value = Pick<Profile, "equipment" | "myEquipment" | "dumbbellMaxKg">;

/** "My equipment": quick presets, then tick exactly what you have; dumbbells get a heaviest-weight field. */
export default function EquipmentEditor({ value, onChange }: { value: Value; onChange: (v: Value) => void }) {
  const { t, settings } = useApp();
  const unit = settings.weightUnit;
  const have = myEquipment(value);
  const list = PICKABLE.filter(e => have.has(e));
  const set = (next: EquipmentId[]) => onChange({ ...value, myEquipment: next, equipment: setupFor(next) });
  const toggle = (e: EquipmentId) => set(have.has(e) ? list.filter(x => x !== e) : PICKABLE.filter(x => x === e || have.has(x)));

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <span className="muted text-sm">{t("equip.quick")}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("equip.quick")}>
          {(["gym", "dumbbells", "bands", "home"] as Equipment[]).map(k => (
            <button key={k} type="button" className="chip" onClick={() => onChange({ ...value, equipment: k, myEquipment: [...PRESETS[k]] })}>{t(`profile.eq.${k}`)}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("equip.mine")}>
        {PICKABLE.map(e => (
          <button key={e} type="button" className="btn flex items-center gap-2 text-left" aria-pressed={have.has(e)} onClick={() => toggle(e)}
            style={{ justifyContent: "flex-start", ...(have.has(e) ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, var(--surface))" } : {}) }}>
            <span style={{ width: 20, color: "var(--accent)" }}>{have.has(e) && <Icon name="check" />}</span>
            <span className="flex-1">{t(`equip.${e}`)}</span>
          </button>
        ))}
      </div>
      {have.has("dumbbell") && (
        <label className="grid gap-1 text-sm"><span className="muted">{t("equip.dbMax", { u: unit })}</span>
          <div style={{ maxWidth: 220 }}>
            <NumInput decimal label={t("equip.dbMax", { u: unit })} value={value.dumbbellMaxKg == null ? null : Number(fmtWeight(value.dumbbellMaxKg, unit))} max={200}
              onChange={v => onChange({ ...value, dumbbellMaxKg: v === null || v === 0 ? null : fromDisplayWeight(v, unit) })} />
          </div>
          <span className="muted text-xs">{t("equip.dbMaxHint")}</span>
        </label>
      )}
      <p className="muted text-xs">{t("equip.always")}</p>
    </div>
  );
}
