import { useState } from "react";
import { useApp } from "../app-context";
import ProgramBuilder from "../components/ProgramBuilder";
import TemplatePicker from "../components/TemplatePicker";
import type { LibraryApi } from "../library/useLibrary";
import type { ProgramApi } from "../program/useProgram";
import Library from "./Library";

export default function Program({ prog, lib }: { prog: ProgramApi; lib: LibraryApi }) {
  const { t } = useApp();
  const [view, setView] = useState<"plan" | "library">("plan");
  const [choosing, setChoosing] = useState(false);

  if (!prog.ready) return null;
  const showPicker = choosing || !prog.active;

  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-bold">{t("tab.program")}</h1>
      <div className="seg" role="group" aria-label={t("tab.program")}>
        <button aria-pressed={view === "plan"} onClick={() => setView("plan")}>{t("prog.tab.plan")}</button>
        <button aria-pressed={view === "library"} onClick={() => setView("library")}>{t("prog.tab.library")}</button>
      </div>
      {view === "library" ? (
        <Library lib={lib} />
      ) : showPicker ? (
        <TemplatePicker onCancel={prog.active ? () => setChoosing(false) : undefined}
          onPick={async spec => { await prog.createFromTemplate(spec); setChoosing(false); }} />
      ) : (
        <ProgramBuilder prog={prog} lib={lib} program={prog.active!} onNew={() => setChoosing(true)} />
      )}
    </section>
  );
}
