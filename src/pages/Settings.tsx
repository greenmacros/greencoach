import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-context";
import { repo } from "../db";
import type { Lang, ThemePref, WeightUnit } from "../db/types";
import Seg from "../components/Seg";
import { parseBackup } from "../db/backup";
import { exportData } from "../lib/exportFile";
import { requestNotifications } from "../workout/alerts";
import GoalsEditor from "../components/GoalsEditor";
import type { LibraryApi } from "../library/useLibrary";
import type { ProgramApi } from "../program/useProgram";
import type { WorkoutLog } from "../workout/types";
import { formatBytes, formatDateTime } from "../lib/format";
import type { BackupFile } from "../db/types";
import BandsEditor from "../components/BandsEditor";
import { SafetyCard } from "../components/Safety";

type Estimate = Awaited<ReturnType<typeof repo.storageEstimate>>;

export default function Settings({ lib, prog, workouts }: { lib: LibraryApi; prog: ProgramApi; workouts: WorkoutLog[] }) {
  const { settings, update, profile, updateProfile, t, reloadAll, dataVersion } = useApp();
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [pending, setPending] = useState<{ file: unknown; n: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void repo.storageEstimate().then(setEstimate); }, [dataVersion, msg]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const json = JSON.parse(await f.text()) as BackupFile;
      const b = parseBackup(json); // validate before asking the user anything
      setPending({ file: json, n: Object.values(b.counts).reduce((a, c) => a + c, 0) });
    } catch (e) {
      const code = e instanceof Error ? e.message.split(":")[0] : "";
      setMsg(t(["not-a-backup", "newer-version"].includes(code) ? `data.err.${code}` : "data.err.generic"));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = async (mode: "merge" | "replace") => {
    if (!pending) return;
    const r = await repo.importAll(pending.file, mode);
    setPending(null);
    await reloadAll();
    setMsg(t("data.importDone", r));
  };

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-bold">{t("tab.settings")}</h1>

      <div className="card grid gap-3">
        <h2 className="font-bold">{t("settings.appearance")}</h2>
        <Seg label={t("settings.theme")} value={settings.theme} onChange={(v: ThemePref) => update({ theme: v })}
          options={(["system", "light", "dark"] as const).map(v => ({ value: v, label: t(`theme.${v}`) }))} />
        <Seg label={t("settings.language")} value={settings.lang} onChange={(v: Lang) => update({ lang: v })}
          options={[{ value: "en", label: "English" }, { value: "ja", label: "日本語" }]} />
      </div>

      <div className="card grid gap-3">
        <h2 className="font-bold">{t("settings.units")}</h2>
        <Seg label={t("settings.weightUnit")} value={settings.weightUnit} onChange={(v: WeightUnit) => update({ weightUnit: v })}
          options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
        <label className="grid gap-1">
          <span>{t("settings.dayStart")}</span>
          <select className="btn" value={settings.dayStartHour} onChange={e => update({ dayStartHour: Number(e.target.value) })}>
            {Array.from({ length: 8 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
          </select>
          <span className="muted text-sm">{t("settings.dayStartHint")}</span>
        </label>
      </div>

      <div className="card grid gap-3">
        <div><h2 className="font-bold">{t("profile.title")}</h2><p className="muted text-sm">{t("profile.hint")}</p></div>
        {([
          ["experience", "profile.experience", ["beginner", "intermediate", "advanced"], "profile.exp."],
          ["goal", "profile.goal", ["muscle", "strength", "cut", "maintain", "recomp"], "profile.goal."],
          ["phase", "profile.phase", ["bulk", "maintain", "cut"], "profile.phase."],
          ["equipment", "profile.equipment", ["gym", "dumbbells", "bands", "home"], "profile.eq."],
        ] as const).map(([field, label, options, prefix]) => (
          <label key={field} className="grid gap-1"><span>{t(label)}</span>
            <select className="field" value={profile[field]} onChange={e => void updateProfile({ [field]: e.target.value } as never)}>
              {options.map(o => <option key={o} value={o}>{t(`${prefix}${o}`)}</option>)}
            </select>
          </label>
        ))}
        <label className="grid gap-1"><span>{t("profile.days")}</span>
          <select className="field" value={profile.daysPerWeek} onChange={e => void updateProfile({ daysPerWeek: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="grid gap-1"><span>{t("profile.region")}</span>
          <select className="field" value={settings.region} onChange={e => void update({ region: e.target.value as never })}>
            {(["JP", "north", "south"] as const).map(o => <option key={o} value={o}>{t(`profile.region.${o}`)}</option>)}
          </select>
        </label>
      </div>

      <GoalsEditor lib={lib} prog={prog} workouts={workouts} />

      <div className="card grid gap-2">
        <h2 className="font-bold">{t("settings.workout")}</h2>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.keepAwake} onChange={e => void update({ keepAwake: e.target.checked })} />{t("wk.keepAwake")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.restSound} onChange={e => void update({ restSound: e.target.checked })} />{t("settings.sound")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.restVibrate} onChange={e => void update({ restVibrate: e.target.checked })} />{t("settings.vibrate")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.restNotify} onChange={async e => {
          if (!e.target.checked) return void update({ restNotify: false });
          const ok = await requestNotifications();
          await update({ restNotify: ok });
          if (!ok) setMsg(t("settings.notifyDenied"));
        }} />{t("settings.notify")}</label>
        <p className="muted text-sm">{t("settings.notifyHint")}</p>
      </div>

      <BandsEditor />

      <div className="card grid gap-2">
        <h2 className="font-bold">{t("settings.coach")}</h2>
        <div className="seg" role="group" aria-label={t("settings.coach")}>
          <button aria-pressed={settings.coachMode !== "ask"} onClick={() => void update({ coachMode: "auto" })}>{t("settings.coachAuto")}</button>
          <button aria-pressed={settings.coachMode === "ask"} onClick={() => void update({ coachMode: "ask" })}>{t("settings.coachAsk")}</button>
        </div>
        <p className="muted text-sm">{t("settings.coachHint")}</p>
      </div>

      <div className="card grid gap-3" aria-labelledby="data-h">
        <h2 id="data-h" className="font-bold">{t("data.title")}</h2>
        <p className="font-semibold">{t("data.storage")}</p>
        {estimate && (
          <p className="muted text-sm">
            {t("data.used", { used: formatBytes(estimate.usage, settings.lang) })} · {estimate.persisted ? t("data.persisted") : t("data.notPersisted")}
          </p>
        )}
        <p className="muted text-sm">{t("data.warning")}</p>
        <p className="text-sm">{settings.lastBackupAt ? t("data.lastBackup", { when: formatDateTime(settings.lastBackupAt, settings.lang) }) : t("data.neverBackup")}</p>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={async () => { await exportData(update); setMsg(t("data.exported")); }}>{t("data.export")}</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>{t("data.import")}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-input" onChange={e => void onFile(e.target.files?.[0])} />
        </div>

        <label className="grid gap-1">
          <span>{t("data.reminder")}</span>
          <select className="btn" value={settings.backupReminderDays} onChange={e => update({ backupReminderDays: Number(e.target.value) })}>
            <option value={0}>{t("data.reminderOff")}</option>
            {[7, 14, 30].map(n => <option key={n} value={n}>{t("data.reminderDays", { n })}</option>)}
          </select>
        </label>

        {pending && (
          <div role="alertdialog" aria-label={t("data.import")} className="card grid gap-2" style={{ borderColor: "var(--accent)" }}>
            <p>{t("data.importMode", { n: pending.n })}</p>
            <button className="btn btn-primary" onClick={() => void doImport("merge")}>{t("data.merge")}</button>
            <button className="btn btn-danger" onClick={() => void doImport("replace")}>{t("data.replace")}</button>
            <button className="btn" onClick={() => setPending(null)}>{t("data.cancel")}</button>
          </div>
        )}

        {confirmDelete ? (
          <div role="alertdialog" className="card grid gap-2" style={{ borderColor: "var(--danger)" }}>
            <p>{t("data.deleteConfirm")}</p>
            <button className="btn btn-danger" onClick={async () => { await repo.deleteAll(); setConfirmDelete(false); await reloadAll(); setMsg(t("data.deleted")); }}>{t("data.deleteYes")}</button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>{t("data.cancel")}</button>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>{t("data.delete")}</button>
        )}
        {msg && <p role="status" className="font-semibold">{msg}</p>}
      </div>
      <SafetyCard />
      <p className="muted text-sm text-center">{t("about.free")}</p>
      <AppVersion />
    </section>
  );
}

/** Build identity so the user can tell whether the installed app is the newest one. */
function AppVersion() {
  const { t, settings } = useApp();
  const [msg, setMsg] = useState("");
  const check = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return setMsg(t("about.latest"));
      await reg.update();
      if (reg.installing || reg.waiting) { setMsg(t("about.updating")); setTimeout(() => location.reload(), 2500); }
      else setMsg(t("about.latest"));
    } catch { setMsg(t("about.offline")); }
  };
  return (
    <div className="grid gap-2 justify-items-center text-center">
      <p className="muted text-xs" data-testid="app-version">{t("about.version", { v: __APP_VERSION__, d: formatDateTime(__BUILD_TIME__, settings.lang), c: __COMMIT__ })}</p>
      <button className="chip" onClick={() => void check()}>{t("about.check")}</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
