// Pulls every source in parallel. Each one fails on its own — a broken token for Ed never blanks the Fitbit rings.

import { cfg } from "./config";
import { toState } from "./errors";
import { googleStatus } from "./google";
import { cached } from "./store";
import { addDays, localTime, ymd } from "./time";
import { getHealth } from "./sources/health";
import { getCalendar, getInbox } from "./sources/google-apps";
import { getShifts } from "./sources/tanda";
import { getMoodleDeadlines, getTimetable } from "./sources/ics";
import { getEd, getOnTrack } from "./sources/uni";
import { getGitHub, getNotionTasks } from "./sources/work";
import { buildCoach } from "./coach";
import { demoData } from "./demo";
import type { DashboardData, DueItem, SourceStatus, TimelineItem } from "./types";

const TTL = { health: 300, cal: 300, inbox: 180, tanda: 1800, ics: 1800, ed: 900, ontrack: 1800, notion: 600, gh: 600 };

export async function buildDashboard(force = false): Promise<DashboardData> {
  if (cfg.demo) return demoData();

  const now = new Date();
  const today = ymd(now);
  const dayStart = localTime(today);
  const twoDays = localTime(addDays(today, 2));
  const google = await googleStatus();

  const sources: SourceStatus[] = [];
  async function run<T>(key: string, label: string, ttl: number, fn: () => Promise<T>): Promise<T | null> {
    try {
      const v = await cached(key, ttl, fn, force);
      sources.push({ key, label, state: "ok" });
      return v;
    } catch (e) {
      const { state, message } = toState(e);
      sources.push({ key, label, state, message });
      return null;
    }
  }

  const [health, cal, inbox, shifts, timetable, moodle, ed, ontrack, notion, dev] = await Promise.all([
    run("health", "Fitbit Air", TTL.health, getHealth),
    run(`cal:${today}`, "Google Calendar", TTL.cal, () => getCalendar(dayStart, twoDays)),
    run("inbox", "Gmail", TTL.inbox, getInbox),
    run(`tanda:${today}`, "Tanda", TTL.tanda, () => getShifts(today, addDays(today, 7))),
    run(`tt:${today}`, "Timetable", TTL.ics, () => getTimetable(dayStart, twoDays)),
    run(`moodle:${today}`, "Moodle", TTL.ics, () => getMoodleDeadlines(new Date(+now - 3 * 86400e3), new Date(+now + 21 * 86400e3))),
    run("ed", "Ed", TTL.ed, getEd),
    run("ontrack", "OnTrack", TTL.ontrack, getOnTrack),
    run("notion", "Notion", TTL.notion, getNotionTasks),
    run("github", "GitHub", TTL.gh, getGitHub),
  ]);

  const events: TimelineItem[] = [...(cal ?? []), ...(shifts ?? []), ...(timetable ?? [])].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const tomorrow = addDays(today, 1);
  const onDay = (d: string) => (e: TimelineItem) => (e.allDay ? e.start.slice(0, 10) === d : ymd(new Date(e.start)) === d);

  // De-dupe: Moodle and Ed sometimes mirror the same deadline; also hide things due >3 days ago.
  const seen = new Set<string>();
  const due: DueItem[] = [...(moodle ?? []), ...(ed?.due ?? []), ...(ontrack ?? []), ...(notion ?? [])]
    .filter((d) => Date.parse(d.due) > +now - 3 * 86400e3)
    .filter((d) => {
      const k = `${d.title.toLowerCase().slice(0, 30)}|${d.due.slice(0, 10)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))
    .slice(0, 12);

  const timeline = { today: events.filter(onDay(today)), tomorrow: events.filter(onDay(tomorrow)) };

  // Keep the sources list in a stable order for the settings strip.
  const order = ["health", "cal", "inbox", "tanda", "tt", "moodle", "ed", "ontrack", "notion", "github"];
  sources.sort((a, b) => order.indexOf(a.key.split(":")[0]) - order.indexOf(b.key.split(":")[0]));

  return {
    generatedAt: now.toISOString(),
    demo: false,
    today,
    health,
    coach: buildCoach(health, timeline, now),
    timeline,
    due,
    inbox,
    dev,
    ed: ed?.ed ?? null,
    sources,
    google: { connected: google.connected, refreshExpiresAt: google.refreshExpiresAt },
  };
}

