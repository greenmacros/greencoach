import { useApp } from "../app-context";
import { bandsOf, type Band } from "../bands/bands";

export const BandDot = ({ band, size = 14 }: { band: Band; size?: number }) => (
  <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: 999, background: band.color, border: "1px solid var(--border)", flex: "none" }} />
);

/** Choose the band(s) used for a set. Tapping several combines them. */
export default function BandPicker({ value, label, onChange, onClose }: { value: readonly string[]; label: string; onChange: (ids: string[]) => void; onClose: () => void }) {
  const { t, settings } = useApp();
  const bands = bandsOf(settings);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : bands.filter(b => b.id === id || value.includes(b.id)).map(b => b.id));
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body grid gap-3" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1"><h2 className="text-xl font-bold">{t("band.pick")}</h2><p className="muted text-sm">{t("band.pickHint")}</p></div>
          <button className="btn btn-primary" onClick={onClose}>{t("band.done")}</button>
        </div>
        <div className="grid gap-2" role="group" aria-label={label}>
          {bands.map((b, i) => (
            <button key={b.id} type="button" className="btn flex items-center gap-3 text-left" aria-pressed={value.includes(b.id)} onClick={() => toggle(b.id)}
              style={value.includes(b.id) ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, var(--surface))" } : undefined}>
              <BandDot band={b} size={18} />
              <span className="flex-1">{b.name}{b.kg != null && <span className="muted text-sm"> · ~{b.kg} kg</span>}</span>
              <span className="muted text-xs">{i === 0 ? t("band.lightest") : i === bands.length - 1 ? t("band.heaviest") : ""}</span>
              {value.includes(b.id) && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <p className="muted text-sm">{t("band.editHint")}</p>
      </div>
    </div>
  );
}
