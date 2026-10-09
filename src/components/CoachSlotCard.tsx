import { useState } from "react";
import { useApp } from "../app-context";
import { isNoChange, proposedValues } from "../coach/apply";
import { explain } from "../coach/explain";
import type { CoachSuggestionRecord, SlotValues } from "../coach/records";
import type { SlotSuggestion, SwapSuggestion, Trend } from "../coach/types";
import { formatRest, fmtWeight, fromDisplayWeight } from "../lib/format";
import type { LibraryApi } from "../library/useLibrary";
import Stepper from "./Stepper";
import { bandLabel, bandsOf } from "../bands/bands";
import { sameBands } from "../coach/apply";
import Icon from "./Icon";

const COLOR: Record<Trend, string> = { up: "var(--accent)", down: "var(--danger)", same: "var(--muted)" };
const ARROW: Record<Trend, React.ReactNode> = { up: <Icon name="triUp" size="0.8em" />, down: <Icon name="triDown" size="0.8em" />, same: "=" };

function Delta({ label, last, next, trend }: { label: string; last: string; next: string; trend: Trend }) {
  const { t } = useApp();
  return (
    <div className="grid text-center" style={{ minWidth: 0 }}>
      <span className="muted text-xs uppercase">{label}</span>
      <span className="font-bold" style={{ color: COLOR[trend] }} aria-label={`${label}: ${next} (${t(`coach.${trend}`)}, ${t("coach.last", { v: last })})`}>
        <span aria-hidden="true">{ARROW[trend]} </span>{next}
      </span>
      <span className="muted text-xs" aria-hidden="true">{last}</span>
    </div>
  );
}

interface Props {
  s: SlotSuggestion;
  swap?: SwapSuggestion;
  decided?: CoachSuggestionRecord;
  lib: LibraryApi;
  onAccept: (swapTo?: string) => void;
  onReject: () => void;
  onEdit: (v: Partial<SlotValues>) => void;
}

export default function CoachSlotCard({ s, swap, decided, lib, onAccept, onReject, onEdit }: Props) {
  const { t, settings } = useApp();
  const unit = settings.weightUnit;
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState(false);
  const p = proposedValues(s);
  const [draft, setDraft] = useState<SlotValues>(p);
  const ex = lib.byId(s.exerciseId);
  const name = ex?.name[settings.lang] ?? t("prog.missing");
  const bands = bandsOf(settings);
  const w = (kg: number | null) => (kg === null ? "–" : `${fmtWeight(kg, unit)}`);
  const same = isNoChange(s);
  const shown = decided?.status === "edited" ? decided.final : p;

  return (
    <article className="card grid gap-2" aria-label={name} style={decided ? { borderColor: decided.status === "rejected" ? "var(--border)" : "var(--accent)" } : undefined}>
      <div className="flex items-start gap-2">
        <h3 className="font-bold flex-1 min-w-0">{name}</h3>
        {decided && <span className="chip" style={{ cursor: "default" }}>{decided.status === "rejected" ? t("coach.rejected") : <><Icon name="check" /> {t("coach.accepted")}</>}</span>}
      </div>
      <div className="grid grid-cols-4 gap-1">
        <Delta label={t("coach.sets")} last={String(s.last.sets)} next={String(shown.sets)} trend={s.trend.sets} />
        <Delta label={t("coach.reps")} last={`${s.last.repMin}-${s.last.repMax}`} next={`${shown.repMin}-${shown.repMax}`} trend={s.trend.reps} />
        {(shown.bands?.length || s.last.bands?.length) ? (
          <Delta label={t("wk.col.band")} last={bandLabel(s.last.bands, bands) || "–"} next={bandLabel(shown.bands, bands) || "–"}
            trend={sameBands(s.last.bands, shown.bands) ? "same" : "up"} />
        ) : (
          <Delta label={`${t("coach.weight")} (${unit})`} last={w(s.last.weightKg)} next={shown.weightKg === null ? t("coach.free") : w(shown.weightKg)} trend={s.trend.weight} />
        )}
        <Delta label={t("coach.rir")} last={String(s.last.rir)} next={String(shown.rir)} trend={s.trend.rir} />
      </div>
      <p className="text-sm"><span className="font-semibold">{t("coach.why")}:</span> {explain(s.reason, t)}</p>
      {s.extra.length > 0 && (
        <>
          <button className="text-left text-sm muted bg-transparent border-0 p-0 cursor-pointer underline" style={{ font: "inherit", fontSize: 14 }} aria-expanded={more} onClick={() => setMore(m => !m)}>
            {more ? "−" : "+"} {s.extra.length}
          </button>
          {more && <ul className="text-sm muted list-disc pl-5">{s.extra.map((r, i) => <li key={i}>{explain(r, t)}</li>)}</ul>}
        </>
      )}
      {shown.restSec !== s.last.restSec && <p className="muted text-xs">{t("coach.rest")}: {formatRest(s.last.restSec)} → {formatRest(shown.restSec)}</p>}

      {swap && !decided && (
        <div className="grid gap-1">
          <p className="text-sm font-semibold">{explain(swap.reason, t)}</p>
          <div className="flex flex-wrap gap-1.5">
            {swap.candidates.map(id => (
              <button key={id} className="chip" onClick={() => onAccept(id)}>{t("coach.swapTo", { name: lib.byId(id)?.name[settings.lang] ?? id })}</button>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <div className="grid gap-2 card" style={{ padding: 10 }}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="grid gap-1"><span className="muted">{t("coach.sets")}</span><Stepper label={`${t("coach.sets")}: ${name}`} value={draft.sets} min={1} max={12} onChange={v => setDraft({ ...draft, sets: v })} /></label>
            <label className="grid gap-1"><span className="muted">{t("coach.rir")}</span><Stepper label={`${t("coach.rir")}: ${name}`} value={draft.rir} min={0} max={6} onChange={v => setDraft({ ...draft, rir: v })} /></label>
            <label className="grid gap-1"><span className="muted">{t("prog.repsMin")}</span><Stepper label={`${t("prog.repsMin")}: ${name}`} value={draft.repMin} min={1} max={draft.repMax} onChange={v => setDraft({ ...draft, repMin: v })} /></label>
            <label className="grid gap-1"><span className="muted">{t("prog.repsMax")}</span><Stepper label={`${t("prog.repsMax")}: ${name}`} value={draft.repMax} min={draft.repMin} max={60} onChange={v => setDraft({ ...draft, repMax: v })} /></label>
          </div>
          <label className="grid gap-1 text-sm"><span className="muted">{t("coach.weight")} ({unit})</span>
            <Stepper label={`${t("coach.weight")}: ${name}`} value={draft.weightKg === null ? 0 : Number(fmtWeight(draft.weightKg, unit))} min={0} max={1000} step={unit === "kg" ? 2.5 : 5}
              onChange={v => setDraft({ ...draft, weightKg: v === 0 ? null : fromDisplayWeight(v, unit) })} />
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => { onEdit(draft); setEditing(false); }}>{t("coach.save")}</button>
            <button className="btn flex-1" onClick={() => setEditing(false)}>{t("data.cancel")}</button>
          </div>
        </div>
      ) : same && !decided ? (
        <p className="muted text-sm">{t("coach.noChange")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {decided?.status !== "accepted" && decided?.status !== "edited" && <button className="btn btn-primary" onClick={() => onAccept()}>{t("coach.accept")}</button>}
          <button className="btn" onClick={() => { setDraft(decided?.status === "edited" ? decided.final : p); setEditing(true); }}>{t("coach.edit")}</button>
          {decided?.status !== "rejected" && <button className="btn" onClick={onReject}>{t("coach.reject")}</button>}
        </div>
      )}
    </article>
  );
}
