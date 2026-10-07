import { useApp } from "../app-context";
import type { LibraryApi } from "../library/useLibrary";
import type { useHistory } from "../workout/useHistory";
import History from "./History";

/** Milestone 5 ships the history here; charts and goals join it in milestone 7. */
export default function Progress({ lib, hist }: { lib: LibraryApi; hist: ReturnType<typeof useHistory> }) {
  const { t } = useApp();
  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-bold">{t("progress.title")}</h1>
      <h2 className="font-bold text-lg">{t("hist.title")}</h2>
      <History lib={lib} hist={hist} />
    </section>
  );
}
