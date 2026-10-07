export function newId(): string {
  return crypto.randomUUID();
}

/** Local-day key (YYYY-MM-DD) honoring a "day starts at N:00" offset. */
export function dayKey(date: Date, dayStartHour = 0): string {
  const d = new Date(date.getTime() - dayStartHour * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
