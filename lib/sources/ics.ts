// Calendar-feed sources: Moodle (deadlines) and the Monash timetable (classes).
// Both give you a private .ics link — no API keys needed.

import ical from "node-ical";
import { cfg } from "../config";
import { SourceError } from "../errors";
import type { DueItem, TimelineItem } from "../types";

interface Occ {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  categories?: string[];
  description?: string;
  url?: string;
}

async function loadIcs(url: string, from: Date, to: Date): Promise<Occ[]> {
  const res = await fetch(url.replace(/^webcal:/, "https:"), { signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!res.ok) throw new SourceError(res.status === 403 || res.status === 401 ? "reconnect" : "error", `Feed returned ${res.status}`);
  const data = ical.sync.parseICS(await res.text());
  const out: Occ[] = [];
  for (const ev of Object.values(data) as any[]) {
    if (ev?.type !== "VEVENT" || !ev.start) continue;
    const dur = (ev.end ? +new Date(ev.end) : +new Date(ev.start)) - +new Date(ev.start);
    const base = {
      uid: String(ev.uid),
      summary: String(typeof ev.summary === "object" ? ev.summary.val : (ev.summary ?? "")),
      allDay: ev.datetype === "date",
      location: typeof ev.location === "string" ? ev.location : ev.location?.val,
      categories: Array.isArray(ev.categories) ? ev.categories : ev.categories ? [String(ev.categories)] : undefined,
      description: typeof ev.description === "string" ? ev.description : ev.description?.val,
      url: typeof ev.url === "string" ? ev.url : ev.url?.val,
    };
    const starts: Date[] = ev.rrule ? ev.rrule.between(new Date(+from - dur), to, true) : [new Date(ev.start)];
    for (const s of starts) {
      const start = new Date(s);
      const end = new Date(+start + dur);
      if (end < from || start > to) continue;
      out.push({ ...base, uid: `${base.uid}:${+start}`, start, end });
    }
  }
  return out.sort((a, b) => +a.start - +b.start);
}

export async function getTimetable(from: Date, to: Date): Promise<TimelineItem[]> {
  if (!cfg.timetable.icsUrl) throw new SourceError("off", "Add TIMETABLE_ICS_URL");
  const occ = await loadIcs(cfg.timetable.icsUrl, from, to);
  return occ.map((o) => ({
    id: `tt:${o.uid}`,
    title: o.summary,
    start: o.start.toISOString(),
    end: o.end.toISOString(),
    allDay: o.allDay,
    source: "timetable",
    location: o.location,
  }));
}

export async function getMoodleDeadlines(from: Date, to: Date): Promise<DueItem[]> {
  if (!cfg.moodle.icsUrl) throw new SourceError("off", "Add MOODLE_ICS_URL");
  const occ = await loadIcs(cfg.moodle.icsUrl, from, to);
  return occ
    .filter((o) => !/opens$|^attendance/i.test(o.summary))
    .map((o) => ({
      id: `moodle:${o.uid}`,
      title: o.summary.replace(/\s+(is due|closes|should be completed)$/i, ""),
      due: (o.allDay ? new Date(+o.start + 23.98 * 3600e3) : o.start).toISOString(),
      source: "moodle",
      course: o.categories?.[0]?.split(/[_\s]/)[0],
      url: o.url,
    }));
}
