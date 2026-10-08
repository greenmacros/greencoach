import { useState } from "react";
import { useApp } from "../app-context";
import type { AutoRecord } from "../coach/auto";
import { changeParts, isMajor } from "../coach/changeText";
import { explain } from "../coach/explain";
import { bandsOf } from "../bands/bands";
import type { LibraryApi } from "../library/useLibrary";

interface Props {
  rec: AutoRecord;
  lib: LibraryApi;
  onUndo: () => void;
  onDismiss: () => void;
  onReview: () => void;
}

const SHOWN = 4;

/** Summary of what automatic coaching did this week (or what it wants the user to review). */
export default function AutoCoachCard({ rec, lib, onUndo, onDismiss, onReview }: Props) {
  const { t, settings } = useApp();
  const [why, setWhy] = useState(false);
  const [all, setAll] = useState(false);
  const name = (id: string) => lib.byId(id)?.name[settings.lang] ?? id;

  if (rec.status === "undone")
    return (
      <div role="status" className="card grid gap-2">
        <p>{t("auto.undone")}</p>
        <button className="btn justify-self-start" onClick={onDismiss}>{t("auto.ok")}</button>
      </div>
    );

  if (rec.status === "review")
    return (
      <div role="status" className="card grid gap-2" style={{ borderColor: "var(--accent)" }}>
        <p className="font-bold">{rec.earlyDeload ? t("auto.reviewDeload") : t("auto.reviewBreak")}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={onReview}>{t("auto.reviewBtn")}</button>
          <button className="btn" onClick={onDismiss}>{t("auto.ok")}</button>
        </div>
      </div>
    );

  const major = rec.changes.filter(isMajor);
  const list = all ? major : major.slice(0, SHOWN);
  const rirChanged = rec.changes.filter(c => c.before.rir !== c.after.rir);
  const restChanged = rec.changes.filter(c => c.before.restSec !== c.after.restSec).length;
  // The week's effort target: the RIR most exercises moved to.
  const rirCounts = new Map<number, number>();
  for (const c of rirChanged) rirCounts.set(c.after.rir, (rirCounts.get(c.after.rir) ?? 0) + 1);
  const weekRir = [...rirCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <div role="status" className="card grid gap-2" style={{ borderColor: "var(--accent)" }}>
      <p className="font-bold">{rec.changes.length ? t("auto.title") : t("auto.none")}</p>
      {list.length > 0 && (
        <ul className="grid gap-1.5">
          {list.map(c => (
            <li key={c.slotId} className="text-sm">
              <span className="font-semibold">{name(c.exerciseId)}</span>{" "}
              {changeParts(c, settings.weightUnit, t, false, bandsOf(settings)).map((p, i) => (
                <span key={i} className="whitespace-nowrap" style={{ color: p.dir === "up" ? "var(--accent)" : "var(--danger)" }}>
                  {i > 0 && <span className="muted"> · </span>}{p.dir === "up" ? "▲" : "▼"} {p.text}
                </span>
              ))}
              {why && <span className="block muted">{explain(c.reason, t)}</span>}
            </li>
          ))}
        </ul>
      )}
      {!all && major.length > SHOWN && <button className="chip justify-self-start" onClick={() => setAll(true)}>{t("auto.more", { n: major.length - SHOWN })}</button>}
      {weekRir !== undefined && <p className="text-sm">{t("auto.rirAll", { n: weekRir })}</p>}
      {restChanged > 0 && <p className="text-sm muted">{t("auto.restN", { n: restChanged })}</p>}
      {rec.swaps > 0 && <p className="text-sm">{t("auto.swaps")} <button className="chip" onClick={onReview}>{t("auto.reviewBtn")}</button></p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onDismiss}>{t("auto.ok")}</button>
        {major.length > 0 && <button className="btn" aria-expanded={why} onClick={() => { setWhy(w => !w); setAll(true); }}>{why ? t("auto.hideWhy") : t("auto.why")}</button>}
        {rec.changes.length > 0 && <button className="btn" onClick={onUndo}>{t("auto.undo")}</button>}
      </div>
    </div>
  );
}
