import { useState } from "react";
import { useApp } from "../app-context";
import { daysSince } from "../lib/format";
import { exportData } from "../lib/exportFile";

const isIosSafari = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;

/** One gentle banner: "add to home screen" (iPhone, browser tab) or "export your data" when overdue. */
export default function BackupNotice() {
  const { settings, update, t } = useApp();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const days = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
  // Never exported: wait one reminder interval from first use instead of nagging on day one.
  const since = days ?? daysSince(settings.createdAt);
  const overdue = settings.backupReminderDays > 0 && settings.onboarded && since >= settings.backupReminderDays;
  const ios = !overdue && isIosSafari();
  if (!overdue && !ios) return null;

  return (
    <div role="note" className="card flex flex-wrap items-center gap-3 mb-4">
      <span className="flex-1 min-w-48">
        {ios ? t("notice.ios") : days === null ? t("notice.backupNever") : t("notice.backup", { n: days })}
      </span>
      {overdue && <button className="btn btn-primary" onClick={async () => { await exportData(update); setHidden(true); }}>{t("notice.now")}</button>}
      <button className="btn" onClick={() => setHidden(true)}>{ios ? t("notice.gotIt") : t("notice.later")}</button>
    </div>
  );
}
