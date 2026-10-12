import { useState } from "react";
import { useApp } from "../app-context";
import { daysSince } from "../lib/format";
import { exportData } from "../lib/exportFile";

/** "Export your data" when a backup is overdue. (Installing is offered by InstallCard.) */
export default function BackupNotice() {
  const { settings, update, t } = useApp();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const days = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
  // Never exported: wait one reminder interval from first use instead of nagging on day one.
  const since = days ?? daysSince(settings.createdAt);
  const overdue = settings.backupReminderDays > 0 && settings.onboarded && since >= settings.backupReminderDays;
  if (!overdue) return null;

  return (
    <div role="note" className="card flex flex-wrap items-center gap-3 mb-4">
      <span className="flex-1 min-w-48">
        {days === null ? t("notice.backupNever") : t("notice.backup", { n: days })}
      </span>
      <button className="btn btn-primary" onClick={async () => { await exportData(update); setHidden(true); }}>{t("notice.now")}</button>
      <button className="btn" onClick={() => setHidden(true)}>{t("notice.later")}</button>
    </div>
  );
}
