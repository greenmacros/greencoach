import { useApp } from "../app-context";
import { SET_TYPES, type SetLog, type SetType } from "../workout/types";
import Icon from "./Icon";

interface Props {
  set: SetLog;
  index: number;
  onType: (t: SetType) => void;
  onAddBelow: () => void;
  onCopy: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Per-set actions and set type, as a bottom sheet (like RP's set menu). */
export default function SetMenu({ set, index, onType, onAddBelow, onCopy, onSkip, onDelete, onClose }: Props) {
  const { t } = useApp();
  const item = "w-full text-left bg-transparent border-0 cursor-pointer";
  const row = { minHeight: 48, padding: "8px 4px", font: "inherit", color: "var(--text)", borderBottom: "1px solid var(--border)" } as const;
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-0" role="dialog" aria-modal="true" aria-label={`${t("wk.menu.title")} ${index + 1}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold">{t("wk.set", { n: index + 1 })}</h2>
          <button className="btn" aria-label={t("wk.menu.close")} onClick={onClose}><Icon name="close" /></button>
        </div>
        <button className={item} style={row} onClick={() => { onAddBelow(); onClose(); }}><Icon name="plus" /> {t("wk.menu.addBelow")}</button>
        <button className={item} style={row} onClick={() => { onCopy(); onClose(); }}><Icon name="copy" /> {t("wk.copy")}</button>
        <button className={item} style={row} onClick={() => { onSkip(); onClose(); }}><Icon name="skip" /> {set.skipped ? t("wk.menu.unskip") : t("wk.menu.skip")}</button>
        <button className={item} style={{ ...row, color: "var(--danger)" }} onClick={() => { onDelete(); onClose(); }}><Icon name="trash" /> {t("wk.menu.delete")}</button>
        <p className="font-bold mt-3 mb-1">{t("wk.menu.type")}</p>
        {SET_TYPES.map(ty => (
          <button key={ty} className={item} style={row} aria-pressed={set.type === ty} onClick={() => { onType(ty); onClose(); }}>
            <span className="font-semibold"><Icon name={set.type === ty ? "dot" : "ring"} /> {t(`wk.type.${ty}`)}</span>
            <br /><span className="muted text-sm">{t(`wk.typeDesc.${ty}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
