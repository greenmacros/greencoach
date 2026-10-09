import { useMemo, useState } from "react";
import { useApp } from "../app-context";
import { fmtWeight, fromDisplayWeight } from "../lib/format";
import type { LibraryApi } from "../library/useLibrary";
import type { ProgramApi } from "../program/useProgram";
import { loggedExercises, smoothWeights, weightPoints } from "../progress/stats";
import type { GoalKind } from "../progress/types";
import { useBody } from "../progress/useBody";
import { goalTitle } from "../pages/progress/GoalsView";
import type { WorkoutLog } from "../workout/types";
import Icon from "./Icon";

/** Settings -> Goals: add and remove goals. Progress is shown on the Progress tab. */
export default function GoalsEditor({ lib, prog, workouts }: { lib: LibraryApi; prog: ProgramApi; workouts: WorkoutLog[] }) {
  const { t, settings } = useApp();
  const { lang, weightUnit: unit } = settings;
  const body = useBody();
  const [kind, setKind] = useState<GoalKind>("lift");
  const [exerciseId, setExerciseId] = useState("");
  const [target, setTarget] = useState("");
  const [perWeek, setPerWeek] = useState(3);
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(false);

  const choices = useMemo(() => {
    const ids = new Set<string>([...loggedExercises(workouts).map(x => x.exerciseId), ...(prog.active?.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)) ?? [])]);
    return [...ids].map(id => lib.byId(id)).filter((e): e is NonNullable<typeof e> => !!e && e.mechanic !== null).sort((a, b) => a.name[lang].localeCompare(b.name[lang]));
  }, [workouts, prog.active, lib, lang]);

  const save = async () => {
    const v = parseFloat(target.replace(",", "."));
    if (kind === "lift" && (!(exerciseId || choices[0]) || !(v > 0))) return;
    if (kind === "bodyweight" && !(v > 0)) return;
    const sm = smoothWeights(weightPoints(body.metrics));
    await body.saveGoal({
      kind,
      exerciseId: kind === "lift" ? exerciseId || choices[0]?.id : undefined,
      targetKg: kind !== "sessions" ? fromDisplayWeight(v, unit) : undefined,
      startKg: kind === "bodyweight" ? sm[sm.length - 1]?.kg : undefined,
      perWeek: kind === "sessions" ? perWeek : undefined,
      targetDate: date || undefined,
      achievedAt: null,
    });
    setTarget(""); setDate(""); setOpen(false);
  };

  return (
    <div className="card grid gap-3" aria-labelledby="goals-h">
      <div><h2 id="goals-h" className="font-bold">{t("goal.title")}</h2><p className="muted text-sm">{t("goal.hint")}</p></div>
      <ul className="grid gap-1">
        {body.goals.map(g => (
          <li key={g.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{goalTitle(g, t, lib, lang, unit)}{g.targetDate ? ` · ${g.targetDate}` : ""}</span>
            <button className="btn" style={{ minWidth: 44, padding: 0 }} aria-label={`${t("goal.delete")}: ${goalTitle(g, t, lib, lang, unit)}`} onClick={() => void body.removeGoal(g.id)}><Icon name="close" /></button>
          </li>
        ))}
      </ul>
      {!open ? <button className="btn" onClick={() => setOpen(true)}><Icon name="plus" /> {t("goal.add")}</button> : (
        <form className="grid gap-2" onSubmit={e => { e.preventDefault(); void save(); }}>
          <label className="grid gap-1 text-sm"><span>{t("goal.kind")}</span>
            <select className="field" value={kind} onChange={e => setKind(e.target.value as GoalKind)}>
              {(["lift", "bodyweight", "sessions"] as GoalKind[]).map(k => <option key={k} value={k}>{t(`goal.kind.${k}`)}</option>)}
            </select>
          </label>
          {kind === "lift" && (
            <label className="grid gap-1 text-sm"><span>{t("goal.exercise")}</span>
              <select className="field" value={exerciseId || choices[0]?.id || ""} onChange={e => setExerciseId(e.target.value)}>
                {choices.map(e => <option key={e.id} value={e.id}>{e.name[lang]}</option>)}
              </select>
            </label>
          )}
          {kind === "sessions" ? (
            <label className="grid gap-1 text-sm"><span>{t("goal.perWeek")}</span>
              <select className="field" value={perWeek} onChange={e => setPerWeek(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n}>{n}</option>)}</select>
            </label>
          ) : (
            <label className="grid gap-1 text-sm"><span>{t("goal.target", { u: unit })}</span>
              <input className="field" inputMode="decimal" required value={target} onChange={e => setTarget(e.target.value)} placeholder={kind === "bodyweight" ? fmtWeight(70, unit) : fmtWeight(100, unit)} />
            </label>
          )}
          <label className="grid gap-1 text-sm"><span>{t("goal.by")}</span><input className="field" type="date" value={date} min={prog.todayKey} onChange={e => setDate(e.target.value)} /></label>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" type="submit">{t("goal.save")}</button>
            <button className="btn flex-1" type="button" onClick={() => setOpen(false)}>{t("data.cancel")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
