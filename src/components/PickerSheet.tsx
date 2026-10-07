import { useApp } from "../app-context";
import type { LibraryApi } from "../library/useLibrary";
import type { Exercise } from "../library/types";
import Library from "../pages/Library";

/** The exercise library as a bottom sheet, for adding or swapping an exercise. */
export default function PickerSheet({ lib, title, onPick, onClose }: { lib: LibraryApi; title: string; onPick: (ex: Exercise) => void; onClose: () => void }) {
  const { t } = useApp();
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="btn" aria-label={t("lib.close")} onClick={onClose}>✕</button>
        </div>
        <Library lib={lib} listHeight="50dvh" onPick={onPick} />
      </div>
    </div>
  );
}
