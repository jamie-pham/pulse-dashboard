// What to push, and when. Pure functions (tested).
//
// Two tiers (Fitz, Kushlev et al. 2019: three batches a day beat constant pings — and beat silence):
//   • Urgent, sent immediately at any hour: leave-by, a deadline closing within a few hours, an emergency near you.
//   • Everything else waits for a digest (8am / 3pm / 9pm by default), which never lands in quiet hours.

import { cfg } from "./config";
import { fmtTime, ymd } from "./time";
import { travelFor } from "./travel";
import type { PushNote } from "./push";
import type { DashboardData } from "./types";

const t = (iso: string) => fmtTime(iso).replace(":00", "");
const minutesOfDay = (d: Date) => {
  const [h, m] = new Intl.DateTimeFormat("en-AU", { timeZone: cfg.tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(d)
    .split(":")
    .map(Number);
  return h * 60 + m;
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function inQuietHours(now: Date, quiet = cfg.notify.quiet): boolean {
  const [a, b] = quiet.split("-").map((s) => s.trim());
  if (!a || !b) return false;
  const m = minutesOfDay(now);
  const start = toMin(a);
  const end = toMin(b);
  return start <= end ? m >= start && m < end : m >= start || m < end;
}

function durationLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60e3));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function urgentNotes(d: Pick<DashboardData, "timeline" | "due" | "alerts">, now = new Date()): PushNote[] {
  const out: PushNote[] = [];
  const lead = cfg.notify.leaveLeadMin * 60e3;

  // 1) Leave-by for anything you have to travel to.
  for (const e of d.timeline.today) {
    if (e.allDay) continue;
    const travel = travelFor(e) * 60e3;
    if (!travel) continue;
    const start = Date.parse(e.start);
    const leaveAt = start - travel;
    if (+now < leaveAt - lead || +now >= start || +now > leaveAt + 20 * 60e3) continue;
    const where = e.location?.split(",")[0];
    out.push({
      id: `leave:${e.id}`,
      urgent: true,
      title: +now < leaveAt ? `🚗 Leave in ${durationLabel(leaveAt - +now)}` : "🚗 Time to leave",
      body: `${e.title} at ${t(e.start)}${where ? ` · ${where}` : ""}`,
    });
  }

  // 2) Deadlines closing soon.
  for (const x of d.due) {
    const left = Date.parse(x.due) - +now;
    if (left <= 0 || left > cfg.notify.deadlineHours * 3600e3) continue;
    out.push({
      id: `due:${x.id}`,
      urgent: true,
      title: `⏰ Closes in ${durationLabel(left)}`,
      body: [x.title, x.course].filter(Boolean).join(" · "),
      url: x.url,
    });
  }

  // 3) Emergencies near you: warnings, and active incidents within 5 km.
  for (const a of d.alerts) {
    if (a.kind !== "warning" && a.distanceKm > 5) continue;
    out.push({
      id: `alert:${a.id}:${a.status}`,
      urgent: true,
      title: `⚠️ ${a.title} — ${a.distanceKm} km away`,
      body: [a.detail, a.status, "Check VicEmergency"].filter(Boolean).join(" · "),
      url: a.url,
    });
  }
  return out;
}

/** Which digest slot (if any) is due now. A slot stays open for an hour, so any cron interval ≤ 60 min works. */
export function digestSlot(now = new Date(), slots = cfg.notify.digests): string | null {
  if (inQuietHours(now)) return null;
  const m = minutesOfDay(now);
  return slots.find((s) => m >= toMin(s) && m < toMin(s) + 60) ?? null;
}

export function digestNote(d: Pick<DashboardData, "brief">, slot: string, now = new Date()): PushNote | null {
  // The three most actionable lines, not just the first three.
  const rank = ["alert", "sleep", "due", "event", "study", "load", "advice", "body", "countdown", "inbox", "info"];
  const score = (k?: string) => (k ? (rank.indexOf(k) + 1 || 99) : 99);
  const lines = d.brief.lines
    .filter((l) => !l.spokenOnly)
    .map((l, i) => ({ l, i }))
    .sort((a, b) => score(a.l.kind) - score(b.l.kind) || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.l);
  if (!lines.length || d.brief.phase === "night") return null;
  return {
    id: `digest:${ymd(now)}:${slot}`,
    title: d.brief.title,
    body: lines.map((l) => `${l.icon} ${l.text}`).join("\n"),
    url: "/",
  };
}
