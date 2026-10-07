import { LIBRARY_MESSAGES } from "./messages-library";
import { PROGRAM_MESSAGES } from "./messages-program";

export interface Entry { en: string; ja: string }
/** Flat key -> {en, ja}; `{name}` placeholders are interpolated. Same shape as GreenMacros. */
const BASE = {
  "app.name": { en: "GreenCoach", ja: "グリーンコーチ" },
  "tab.today": { en: "Today", ja: "今日" },
  "tab.program": { en: "Program", ja: "プログラム" },
  "tab.progress": { en: "Progress", ja: "進捗" },
  "tab.coach": { en: "Coach", ja: "コーチ" },
  "tab.settings": { en: "Settings", ja: "設定" },
  "soon.title": { en: "Coming soon", ja: "近日公開" },
  "soon.body": { en: "This screen is built in a later milestone.", ja: "この画面は今後のアップデートで追加されます。" },

  "settings.appearance": { en: "Appearance", ja: "外観" },
  "settings.theme": { en: "Theme", ja: "テーマ" },
  "theme.system": { en: "System", ja: "システム" },
  "theme.light": { en: "Light", ja: "ライト" },
  "theme.dark": { en: "Dark", ja: "ダーク" },
  "settings.language": { en: "Language", ja: "言語" },
  "settings.units": { en: "Units", ja: "単位" },
  "settings.weightUnit": { en: "Weight", ja: "重量" },
  "settings.dayStart": { en: "New day starts at", ja: "1日の開始時刻" },
  "settings.dayStartHint": { en: "Late-night sessions before this hour count as the previous day.", ja: "この時刻より前のトレーニングは前日として扱われます。" },

  "data.title": { en: "Data", ja: "データ" },
  "data.storage": { en: "Storage: on this device", ja: "保存場所：この端末内" },
  "data.warning": { en: "Clearing your browser data deletes everything unless you export it first.", ja: "ブラウザのデータを消去すると、書き出していない限りすべて失われます。" },
  "data.persisted": { en: "Protected from automatic cleanup", ja: "自動削除から保護されています" },
  "data.notPersisted": { en: "Not protected from automatic cleanup. Installing to the home screen helps.", ja: "自動削除から保護されていません。ホーム画面に追加すると改善します。" },
  "data.used": { en: "{used} used", ja: "{used} 使用中" },
  "data.export": { en: "Export all data", ja: "すべてのデータを書き出す" },
  "data.import": { en: "Import from file", ja: "ファイルから読み込む" },
  "data.lastBackup": { en: "Last export: {when}", ja: "最後の書き出し：{when}" },
  "data.neverBackup": { en: "You have never exported your data.", ja: "まだデータを書き出していません。" },
  "data.reminder": { en: "Backup reminder", ja: "バックアップのリマインダー" },
  "data.reminderDays": { en: "Every {n} days", ja: "{n}日ごと" },
  "data.reminderOff": { en: "Off", ja: "オフ" },
  "data.importMode": { en: "How should we import {n} records?", ja: "{n}件のデータをどう読み込みますか？" },
  "data.merge": { en: "Merge (keep newest)", ja: "統合（新しい方を残す）" },
  "data.replace": { en: "Replace everything", ja: "すべて置き換える" },
  "data.cancel": { en: "Cancel", ja: "キャンセル" },
  "data.importDone": { en: "Imported: {added} added, {updated} updated, {skipped} unchanged.", ja: "読み込み完了：追加{added}件、更新{updated}件、変更なし{skipped}件。" },
  "data.err.not-a-backup": { en: "That file is not a GreenCoach backup.", ja: "GreenCoachのバックアップファイルではありません。" },
  "data.err.newer-version": { en: "That backup comes from a newer version of the app.", ja: "より新しいバージョンのアプリのバックアップです。" },
  "data.err.generic": { en: "Could not read that file.", ja: "ファイルを読み込めませんでした。" },
  "data.delete": { en: "Delete all data", ja: "すべてのデータを削除" },
  "data.deleteConfirm": { en: "This permanently deletes everything on this device. Export first if unsure.", ja: "この端末のすべてのデータを完全に削除します。不安な場合は先に書き出してください。" },
  "data.deleteYes": { en: "Delete everything", ja: "すべて削除する" },
  "data.deleted": { en: "All data deleted.", ja: "すべてのデータを削除しました。" },
  "data.exported": { en: "Backup saved.", ja: "バックアップを保存しました。" },
  "notice.backup": { en: "It has been {n} days since your last export. Export your data to stay safe.", ja: "最後の書き出しから{n}日経ちました。データを書き出しておきましょう。" },
  "notice.backupNever": { en: "You have not exported your data yet. Export it to stay safe.", ja: "まだデータを書き出していません。書き出しておきましょう。" },
  "notice.now": { en: "Export now", ja: "今すぐ書き出す" },
  "notice.later": { en: "Later", ja: "後で" },
  "notice.ios": { en: "Tip: on iPhone, tap Share then \"Add to Home Screen\" so your data is kept safely.", ja: "ヒント：iPhoneでは共有ボタンから「ホーム画面に追加」するとデータが安全に保たれます。" },
  "notice.gotIt": { en: "Got it", ja: "OK" },
  "about.free": { en: "Free for life. No accounts, no ads, no tracking.", ja: "ずっと無料。アカウント不要、広告なし、トラッキングなし。" },
} as const satisfies Record<string, Entry>;

export const MESSAGES = { ...BASE, ...LIBRARY_MESSAGES, ...PROGRAM_MESSAGES };

export type MessageKey = keyof typeof MESSAGES;
