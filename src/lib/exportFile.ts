import { repo } from "../db";
import { backupFilename } from "../db/backup";
import type { Settings } from "../db/types";

/** Builds the backup, triggers a file download, and records the export time. */
export async function exportData(update: (p: Partial<Settings>) => Promise<void>): Promise<void> {
  const backup = await repo.exportAll();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await update({ lastBackupAt: backup.exportedAt });
}
