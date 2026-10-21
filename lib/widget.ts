// The lock screen feed: the smallest useful slice of the dashboard, for the iOS widgets.
// Pure (tested). Deliberately leaves out email subjects, pay and anything else you wouldn't want
// readable on a locked phone — the widget only gets what it shows.
//
// The phone builds its own timeline from these times (e.g. "next event" flips over as events end, and
// "leave in N min" counts down live), so the feed only has to be fetched every ~30 minutes.

import { cfg } from "./config";
import { travelFrom } from "./travel";
import { weightOf } from "./workload";
import { wmo, isWet } from "./weather-advice";
import type { DashboardData, TimelineItem } from "./types";

export interface WidgetEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  leaveAt: string | null; // null = nothing to travel to (online / no place)
  where: string | null;
  kind: "class" | "shift" | "event";
}

export interface WidgetFeed {
  v: 1;
  generatedAt: string;
  tz: string;
  weather: {
    temp: number;
    feels: number;
    icon: string;
    label: string;
    hi: number;
    lo: number;
    rainAt: string | null; // first hour with ≥50% chance in the next ~16h
    rainPop: number | null;
    tip: string | null; // the top "take this" line, e.g. "Jacket — feels like 9°"
  } | null;
  recovery: { score: number; band: string } | null;
  events: WidgetEvent[];
  due: { title: string; due: string; course: string | null; weight: number | null }[];
  study: { title: string; start: string; end: string } | null;
  alert: { title: string; detail: string; distanceKm: number } | null;
  lines: { icon: string; text: string; kind: string }[];
}

const RANK = ["alert", "sleep", "due", "event", "study", "load", "advice", "body", "countdown", "inbox", "info"];
const kindOf = (e: TimelineItem): WidgetEvent["kind"] =>
  e.source === "timetable" || /\bCL_|\bCA_|monash/i.test(`${e.location ?? ""}`) ? "class" : e.source === "tanda" || /^work\b|^shift\b/i.test(e.title) ? "shift" : "event";

/** "Assignment 3 [Group | 18%]" → "Assignment 3" — the lock screen has room for about 20 characters. */
export function shortTitle(s: string): string {
  return s
    .replace(/\s*[[(][^\])]*%[^\])]*[\])]/g, "")
    .replace(/\s+(submission|lesson)$/i, "")
    .trim();
}

export function buildWidget(d: DashboardData, now = new Date()): WidgetFeed {
  const horizon = +now + 36 * 3600e3;
  const all = [...d.timeline.today, ...d.timeline.tomorrow];
  const events = all
    .filter((e) => !e.allDay && Date.parse(e.end) > +now && Date.parse(e.start) < horizon)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 8)
    .map((e): WidgetEvent => {
      const mins = travelFrom(e, all);
      return {
        id: e.id,
        title: shortTitle(e.title),
        start: e.start,
        end: e.end,
        leaveAt: mins ? new Date(Date.parse(e.start) - mins * 60e3).toISOString() : null,
        where: e.source === "timetable" ? cfg.campus.label : (e.location?.split(",")[0] ?? null),
        kind: kindOf(e),
      };
    });

  const w = d.weather;
  const wet = w?.hours.find((h) => h.pop >= 50 && Date.parse(h.time) >= +now - 3600e3) ?? null;
  const tip = w?.advice.find((a) => !/^(☀️|🌙)/.test(a.icon)) ?? null;

  const r = d.health?.recovery;
  const alert = d.alerts.find((a) => a.kind === "warning") ?? d.alerts.find((a) => a.distanceKm <= 5) ?? null;

  return {
    v: 1,
    generatedAt: d.generatedAt,
    tz: cfg.tz,
    weather: w
      ? {
          temp: Math.round(w.now.temp),
          feels: Math.round(w.now.feels),
          icon: wmo(w.now.code, w.now.isDay).icon,
          label: wmo(w.now.code, w.now.isDay).label,
          hi: Math.round(w.today.max),
          lo: Math.round(w.today.min),
          rainAt: isWet(w.now.code) ? now.toISOString() : (wet?.time ?? null),
          rainPop: isWet(w.now.code) ? 100 : (wet?.pop ?? null),
          tip: tip ? `${tip.icon} ${tip.text}` : null,
        }
      : null,
    recovery: r && r.score != null && !r.calibrating ? { score: Math.round(r.score), band: r.band ?? "yellow" } : null,
    events,
    due: d.due
      .filter((x) => Date.parse(x.due) > +now)
      .slice(0, 3)
      .map((x) => ({ title: shortTitle(x.title), due: x.due, course: x.course ?? null, weight: weightOf(x.title) })),
    study: d.workload.blocks[0]
      ? { title: shortTitle(d.workload.blocks[0].task.title), start: d.workload.blocks[0].start, end: d.workload.blocks[0].end }
      : null,
    alert: alert ? { title: alert.title, detail: alert.detail, distanceKm: Math.round(alert.distanceKm) } : null,
    lines: d.brief.lines
      .filter((l) => !l.spokenOnly && l.kind !== "inbox")
      .map((l, i) => ({ l, i }))
      .sort((a, b) => (RANK.indexOf(a.l.kind ?? "info") + 1 || 99) - (RANK.indexOf(b.l.kind ?? "info") + 1 || 99) || a.i - b.i)
      .slice(0, 3)
      .map(({ l }) => ({ icon: l.icon, text: l.text, kind: l.kind ?? "info" })),
  };
}
