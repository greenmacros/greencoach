import { useApp } from "../app-context";
import type { SorenessLevel, SorenessQuestion } from "../feedback/soreness";
import ChipRow from "./ChipRow";

interface Props {
  questions: SorenessQuestion[];
  answers: Map<string, SorenessLevel>;
  onAnswer: (muscle: SorenessQuestion["muscle"], level: SorenessLevel, prevWorkoutId: string) => void;
}

export default function SorenessCard({ questions, answers, onAnswer }: Props) {
  const { t } = useApp();
  if (questions.length === 0) return null;
  const all = questions.every(q => answers.has(q.muscle));
  return (
    <section className="card grid gap-3" aria-label={t("fb.soreTitle")}>
      <div>
        <h2 className="font-bold">{t("fb.soreTitle")}</h2>
        <p className="muted text-sm">{all ? t("fb.soreThanks") : t("fb.soreHint")}</p>
      </div>
      {questions.map(q => (
        <ChipRow<SorenessLevel> key={q.muscle} label={t("fb.soreRow", { muscle: t(`muscle.${q.muscle}`), n: q.daysAgo })} value={answers.get(q.muscle)}
          onChange={v => onAnswer(q.muscle, v, q.prevWorkoutId)}
          options={([0, 1, 2] as SorenessLevel[]).map(n => ({ value: n, label: t(`fb.sore.${n}`) }))} />
      ))}
    </section>
  );
}
