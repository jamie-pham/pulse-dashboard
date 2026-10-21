// Workload heatmap + study-block suggestions. Pure functions (tested) — no I/O.
//
// Design rules (see PRINCIPLES.md): glanceable first (one headline line), detail on tap,
// and zero manual entry — weights are read straight out of Moodle titles like "[Individual | 15%]".

import { addDays, fmtDay, fmtTime, localTime, ymd } from "./time";
import { travelFor } from "./travel";
import type { DueItem, TimelineItem } from "./types";

export interface DayLoad {
  date: string;
  count: number;
  weight: number; // sum of known % weights
  score: number; // what drives the colour: known weights + a default for unknowns
  level: 0 | 1 | 2 | 3 | 4;
  items: { id: string; title: string; course?: string; weight: number | null; due: string }[];
}

export interface StudyBlock {
  start: string;
  end: string;
  task: { title: string; course?: string; weight: number | null; due: string };
}

export interface Workload {
  days: DayLoad[];
  headline: { text: string; level: number } | null;
  blocks: StudyBlock[];
}

const UNKNOWN_WEIGHT = 2; // a typical quiz/reflection when the title doesn't say

/** "Assignment 3 [Group | 18%]" → 18. "Quiz (0.6%)" → 0.6. No % → null. */
export function weightOf(title: string): number | null {
  const m = title.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 100 ? n : null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !["is", "due", "the", "closes", "opens"].includes(w));

/** A short calendar block that's really just a copy of a Moodle deadline (e.g. a 10-min "FIT1049 Reflection W11" at 11:45pm). */
export function isDeadlineEcho(e: TimelineItem, due: DueItem[]): boolean {
  if (e.source !== "calendar" || e.allDay) return false;
  const et = norm(e.title);
  if (et.length < 2) return false;
  const short = Date.parse(e.end) - Date.parse(e.start) <= 20 * 60e3;
  return due.some((d) => {
    const gap = Math.abs(Date.parse(d.due) - Date.parse(e.start));
    // Same deadline: within 3h of it, or a short reminder block for it any time in the fortnight around it.
    if (gap > 3 * 3600e3 && !(short && gap < 14 * 86400e3)) return false;
    const dt = norm(d.title);
    if (dt.length < 2) return false;
    const [a, b] = et.length <= dt.length ? [et, dt] : [dt, et];
    return a.every((w) => b.includes(w));
  });
}

export function levelOf(score: number): DayLoad["level"] {
  return score <= 0 ? 0 : score < 3 ? 1 : score < 8 ? 2 : score < 15 ? 3 : 4;
}

export function dayLoads(due: DueItem[], now = new Date(), days = 14): DayLoad[] {
  const today = ymd(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const items = due
      .filter((d) => ymd(new Date(d.due)) === date && Date.parse(d.due) > +now - 3600e3)
      .map((d) => ({ id: d.id, title: d.title, course: d.course, weight: weightOf(d.title), due: d.due }));
    const weight = Math.round(items.reduce((s, x) => s + (x.weight ?? 0), 0) * 10) / 10;
    const score = items.reduce((s, x) => s + (x.weight ?? UNKNOWN_WEIGHT), 0);
    return { date, count: items.length, weight, score, level: levelOf(score), items };
  });
}

export function workloadHeadline(days: DayLoad[]): Workload["headline"] {
  const week = days.slice(0, 7);
  const peak = week.reduce<DayLoad | null>((a, d) => (!a || d.score > a.score ? d : a), null);
  if (!peak || peak.score < 8) {
    const total = week.reduce((s, d) => s + d.count, 0);
    return total ? { text: `Light week — ${total} small deadline${total === 1 ? "" : "s"}`, level: 1 } : null;
  }
  const when = peak.date === days[0].date ? "today" : peak.date === days[1]?.date ? "tomorrow" : fmtDay(`${peak.date}T12:00:00`);
  const w = peak.weight ? `, ${peak.weight}% of grades` : "";
  return { text: `Heavy ${when}: ${peak.count} deadline${peak.count === 1 ? "" : "s"}${w}`, level: peak.level };
}

interface Span {
  start: number;
  end: number;
}

/** Free gaps of 60+ min between 8am and 9:30pm, today and tomorrow, around everything on the timeline (incl. travel). */
export function freeGaps(events: TimelineItem[], now = new Date()): Span[] {
  const out: Span[] = [];
  for (const day of [ymd(now), addDays(ymd(now), 1)]) {
    let from = +localTime(day, "08:00");
    const until = +localTime(day, "21:30");
    if (day === ymd(now)) from = Math.max(from, Math.ceil((+now + 15 * 60e3) / (30 * 60e3)) * 30 * 60e3);
    const busy: Span[] = events
      .filter((e) => !e.allDay)
      .map((e) => {
        const t = travelFor(e) * 60e3;
        return { start: Date.parse(e.start) - t, end: Date.parse(e.end) + t };
      })
      .filter((b) => b.end > from && b.start < until)
      .sort((a, b) => a.start - b.start);
    let cursor = from;
    for (const b of busy) {
      if (b.start - cursor >= 60 * 60e3) out.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (until - cursor >= 60 * 60e3) out.push({ start: cursor, end: until });
  }
  return out;
}

export function studyBlocks(events: TimelineItem[], due: DueItem[], now = new Date(), max = 3): StudyBlock[] {
  const gaps = freeGaps(events, now);
  const out: StudyBlock[] = [];
  const used = new Set<string>();
  const perDay = new Map<string, number>();
  for (const g of gaps) {
    if (out.length >= max) break;
    const day = ymd(new Date(g.start));
    if ((perDay.get(day) ?? 0) >= 2) continue;
    const candidates = due
      .filter((d) => Date.parse(d.due) > g.start + 30 * 60e3 && Date.parse(d.due) - g.start < 14 * 86400e3)
      .map((d) => {
        const w = weightOf(d.title) ?? UNKNOWN_WEIGHT;
        const daysLeft = Math.max((Date.parse(d.due) - g.start) / 86400e3, 0.5);
        return { d, w, p: w / daysLeft };
      })
      .sort((a, b) => b.p - a.p);
    const pick = candidates.find((c) => !used.has(c.d.id)) ?? candidates[0];
    if (!pick) continue;
    used.add(pick.d.id);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    out.push({
      start: new Date(g.start).toISOString(),
      end: new Date(Math.min(g.end, g.start + 2 * 3600e3)).toISOString(),
      task: { title: pick.d.title, course: pick.d.course, weight: weightOf(pick.d.title), due: pick.d.due },
    });
  }
  return out;
}

export function buildWorkload(due: DueItem[], events: TimelineItem[], now = new Date()): Workload {
  const days = dayLoads(due, now);
  return { days, headline: workloadHeadline(days), blocks: studyBlocks(events, due, now) };
}

/** "1–3pm" */
export function spanLabel(start: string, end: string): string {
  const a = fmtTime(start).replace(":00", "");
  const b = fmtTime(end).replace(":00", "");
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}
