import { cfg } from "./config";

/** YYYY-MM-DD for a moment, in the dashboard's time zone. */
export function ymd(d: Date = new Date(), tz = cfg.tz): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function ymdFromParts(p?: { year?: number; month?: number; day?: number } | null): string | null {
  if (!p?.year || !p.month || !p.day) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function dateParts(day: string) {
  const [year, month, d] = day.split("-").map(Number);
  return { year, month, day: d };
}

/** Minutes the zone is ahead of UTC at a given moment (e.g. +660 for AEDT). */
export function tzOffsetMin(d: Date, tz = cfg.tz): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** The UTC instant of a local wall-clock time (default midnight) on a local date. */
export function localTime(day: string, hhmm = "00:00", tz = cfg.tz): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const off1 = tzOffsetMin(guess, tz);
  let t = guess.getTime() - off1 * 60000;
  const off2 = tzOffsetMin(new Date(t), tz);
  if (off2 !== off1) t = guess.getTime() - off2 * 60000;
  return new Date(t);
}

export function fmtTime(iso: string | Date, tz = cfg.tz): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(" ", "")
    .toLowerCase();
}

export function fmtDay(iso: string | Date, tz = cfg.tz): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(
    new Date(iso),
  );
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** "in 3d", "tomorrow", "today 5pm", "2d overdue" — relative to now in the dashboard zone. */
export function relDue(iso: string, now = new Date()): { label: string; urgency: "overdue" | "today" | "soon" | "later" } {
  const due = new Date(iso);
  const today = ymd(now);
  const dueDay = ymd(due);
  const days = Math.round((Date.parse(dueDay) - Date.parse(today)) / 86400000);
  if (due.getTime() < now.getTime()) {
    return { label: days === 0 ? `overdue ${fmtTime(due)}` : `${-days}d overdue`, urgency: "overdue" };
  }
  if (days === 0) return { label: `today ${fmtTime(due)}`, urgency: "today" };
  if (days === 1) return { label: `tomorrow ${fmtTime(due)}`, urgency: "soon" };
  if (days <= 3) return { label: `${fmtDay(due)} ${fmtTime(due)}`, urgency: "soon" };
  return { label: fmtDay(due), urgency: "later" };
}
