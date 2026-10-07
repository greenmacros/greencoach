import { useApp } from "../app-context";
import { useLibrary } from "../library/useLibrary";
import Library from "./Library";

/** Milestone 2: the Program tab hosts the library. The weekly builder arrives in milestone 3. */
export default function Program() {
  const { t } = useApp();
  const lib = useLibrary();
  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-bold">{t("lib.title")}</h1>
      <Library lib={lib} />
    </section>
  );
}
