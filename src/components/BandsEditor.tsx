import { useState } from "react";
import { useApp } from "../app-context";
import { BAND_COLORS, bandsOf, type Band } from "../bands/bands";
import { newId } from "../lib/id";
import { BandDot } from "./BandPicker";
import NumInput from "./NumInput";
import TextInput from "./TextInput";

/** Settings → My bands: name, colour, optional kg from the package, and order (lightest first). */
export default function BandsEditor() {
  const { t, settings, update } = useApp();
  const bands = bandsOf(settings);
  const [open, setOpen] = useState<string | null>(null);
  const save = (next: Band[]) => void update({ bands: next });
  const patch = (id: string, p: Partial<Band>) => save(bands.map(b => (b.id === id ? { ...b, ...p } : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bands.length) return;
    const next = [...bands];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  return (
    <div className="card grid gap-2" aria-labelledby="bands-h">
      <h2 id="bands-h" className="font-bold">{t("band.title")}</h2>
      <p className="muted text-sm">{t("band.hint")}</p>
      <ol className="grid gap-2">
        {bands.map((b, i) => (
          <li key={b.id} className="grid gap-2" style={{ borderTop: i ? "1px solid var(--border)" : undefined, paddingTop: i ? 8 : 0 }}>
            <div className="flex items-center gap-2">
              <span className="muted text-xs" style={{ width: 16 }}>{i + 1}</span>
              <BandDot band={b} size={20} />
              <button type="button" className="flex-1 text-left font-semibold" style={{ background: "none", border: 0, padding: 0, minHeight: 44, color: "var(--text)", cursor: "pointer" }}
                aria-expanded={open === b.id} onClick={() => setOpen(o => (o === b.id ? null : b.id))}>
                {b.name}{b.kg != null && <span className="muted font-normal text-sm"> · ~{b.kg} kg</span>}
              </button>
              <button className="btn" style={{ minWidth: 44, padding: 0 }} disabled={i === 0} aria-label={`${t("band.lighter")}: ${b.name}`} onClick={() => move(i, -1)}>↑</button>
              <button className="btn" style={{ minWidth: 44, padding: 0 }} disabled={i === bands.length - 1} aria-label={`${t("band.heavier")}: ${b.name}`} onClick={() => move(i, 1)}>↓</button>
            </div>
            {open === b.id && (
              <div className="grid gap-2" style={{ paddingLeft: 24 }}>
                <label className="grid gap-1 text-sm"><span className="muted">{t("band.name")}</span>
                  <TextInput className="field" value={b.name} onValue={v => patch(b.id, { name: v })} />
                </label>
                <div className="grid gap-1 text-sm"><span className="muted">{t("band.color")}</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("band.color")}>
                    {BAND_COLORS.map(c => (
                      <button key={c} type="button" aria-pressed={b.color === c} aria-label={c} onClick={() => patch(b.id, { color: c })}
                        style={{ width: 36, height: 36, borderRadius: 999, background: c, border: b.color === c ? "3px solid var(--accent)" : "1px solid var(--border)", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
                <label className="grid gap-1 text-sm"><span className="muted">{t("band.kg")}</span>
                  <div style={{ maxWidth: 220 }}><NumInput decimal label={t("band.kg")} value={b.kg} max={200} onChange={v => patch(b.id, { kg: v })} /></div>
                </label>
                <button className="btn btn-danger justify-self-start" disabled={bands.length <= 1} onClick={() => { setOpen(null); save(bands.filter(x => x.id !== b.id)); }}>{t("band.remove")}</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className="btn justify-self-start" onClick={() => {
        const id = "band-" + newId();
        save([...bands, { id, name: t("band.new", { n: bands.length + 1 }), color: BAND_COLORS[bands.length % BAND_COLORS.length], kg: null }]);
        setOpen(id);
      }}>＋ {t("band.add")}</button>
    </div>
  );
}
