// Pulls every source in parallel. Each one fails on its own — a broken token for Ed never blanks the Fitbit rings.

import { cfg } from "./config";
import { toState } from "./errors";
import { ensurePrimaryEmail, googleStatus, PRIMARY } from "./google";
import { cached } from "./store";
import { addDays, localTime, ymd } from "./time";
import { getHealth } from "./sources/health";
import { dedupeEvents, getCalendar, getInbox, mergeInboxes } from "./sources/google-apps";
import { getPay, getShifts } from "./sources/tanda";
import { getMoodleDeadlines, getTimetable } from "./sources/ics";
import { getEd, getOnTrack } from "./sources/uni";
import { getGitHub, getNotionTasks } from "./sources/work";
import { buildCoach, recoveryWhy } from "./coach";
import { demoData } from "./demo";
import { buildBrief } from "./brief";
import { getCountdowns, getRoutine } from "./extras";
import { getLocation } from "./location";
import { isCampus } from "./travel";
import { getWeather } from "./sources/weather";
import { getAlerts } from "./sources/alerts";
import { buildWorkload, isDeadlineEcho } from "./workload";
import type { DashboardData, DueItem, InboxData, SourceStatus, TimelineItem } from "./types";

/** "jamie@student.monash.edu" → "monash", "someone@gmail.com" → "someone" */
export function accountLabel(email: string): string {
  const [local, host = ""] = email.toLowerCase().split("@");
  if (/^(gmail|googlemail)\./.test(host)) return local;
  const skip = new Set(["com", "edu", "au", "org", "net", "co", "student", "mail", "students", "uk", "nz", "io", "app"]);
  const parts = host.split(".").filter((p) => !skip.has(p));
  return parts.sort((a, b) => b.length - a.length)[0] ?? host;
}

const TTL = { health: 300, cal: 300, inbox: 180, tanda: 1800, ics: 1800, ed: 900, ontrack: 1800, notion: 600, gh: 600 };

/** `at` (HH:MM) only works in demo mode — handy for previewing the morning/evening brief. */
export async function buildDashboard(force = false, at?: string): Promise<DashboardData> {
  if (cfg.demo) return demoData(at && /^\d{2}:\d{2}$/.test(at) ? localTime(ymd(), at) : new Date());

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

  // Extra Google accounts (Monash, work, …): calendar + Gmail, merged with the primary's.
  const extras = google.accounts.slice(1).filter((a) => a.connected && a.email) as { email: string }[];
  const primaryEmail = google.connected ? await ensurePrimaryEmail() : null;
  const extraCalendars = Promise.all(
    extras.map((a) =>
      run(`cal:${a.email}:${today}`, `Calendar · ${accountLabel(a.email)}`, TTL.cal, () =>
        getCalendar(dayStart, twoDays, a.email, accountLabel(a.email)),
      ),
    ),
  );
  const extraInboxes = Promise.all(
    extras.map((a) => run(`inbox:${a.email}`, `Gmail · ${accountLabel(a.email)}`, TTL.inbox, () => getInbox(a.email, a.email))),
  );

  const [health, cal, inbox, shifts, timetable, moodle, ed, ontrack, notion, dev] = await Promise.all([
    run("health", "Fitbit Air", TTL.health, getHealth),
    run(`cal:${today}`, "Google Calendar", TTL.cal, () => getCalendar(dayStart, twoDays, PRIMARY)),
    run("inbox:primary", "Gmail", TTL.inbox, () => getInbox(PRIMARY, primaryEmail ?? undefined)),
    run(`tanda:${today}`, "Tanda", TTL.tanda, () => getShifts(today, addDays(today, 7))),
    run(`tt:${today}`, "Timetable", TTL.ics, () => getTimetable(dayStart, twoDays)),
    run(`moodle:${today}`, "Moodle", TTL.ics, () => getMoodleDeadlines(new Date(+now - 3 * 86400e3), new Date(+now + 21 * 86400e3))),
    run("ed", "Ed", TTL.ed, getEd),
    run("ontrack", "OnTrack", TTL.ontrack, getOnTrack),
    run("notion", "Notion", TTL.notion, getNotionTasks),
    run("github", "GitHub", TTL.gh, getGitHub),
  ]);

  const [extraCal, extraInbox] = await Promise.all([extraCalendars, extraInboxes]);
  const inboxAll = mergeInboxes([inbox, ...extraInbox].filter(Boolean) as InboxData[]);
  const pay = await run(`pay:${today}`, "Tanda pay", TTL.tanda, () => getPay(shifts ?? []));

  const allEvents: TimelineItem[] = dedupeEvents(
    [...(cal ?? []), ...extraCal.flatMap((x) => x ?? []), ...(shifts ?? []), ...(timetable ?? [])].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start),
    ),
  );
  const tomorrow = addDays(today, 1);
  const onDay = (d: string) => (e: TimelineItem) => (e.allDay ? e.start.slice(0, 10) === d : ymd(new Date(e.start)) === d);

  // De-dupe: Moodle and Ed sometimes mirror the same deadline; also hide things due >3 days ago.
  const seen = new Set<string>();
  const dueAll: DueItem[] = [...(moodle ?? []), ...(ed?.due ?? []), ...(ontrack ?? []), ...(notion ?? [])]
    .filter((d) => Date.parse(d.due) > +now - 3 * 86400e3)
    .filter((d) => {
      const k = `${d.title.toLowerCase().slice(0, 30)}|${d.due.slice(0, 10)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const due = dueAll.slice(0, 12);

  // Calendar blocks that are just copies of a Moodle deadline don't belong on the timeline.
  const events = allEvents.filter((e) => !isDeadlineEcho(e, dueAll));
  const timeline = { today: events.filter(onDay(today)), tomorrow: events.filter(onDay(tomorrow)) };
  const workload = buildWorkload(dueAll, [...timeline.today, ...timeline.tomorrow], now);

  // Weather + nearby emergencies for wherever you are (phone location if you've shared it, else HOME_LAT/LON).
  const loc = await getLocation();
  const firstCampus = timeline.today.find((e) => !e.allDay && isCampus(e) && Date.parse(e.start) > +now);
  const [weather, alerts, routine] = await Promise.all([
    run(`wx:${loc.lat},${loc.lon}:${firstCampus?.start ?? ""}`, "Weather", 900, () =>
      getWeather(loc.lat, loc.lon, loc.label, firstCampus?.start),
    ),
    run(`alerts:${loc.lat},${loc.lon}`, "VicEmergency", 300, () => getAlerts(loc.lat, loc.lon)),
    getRoutine(today),
  ]);

  // Keep the sources list in a stable order for the settings strip.
  const order = ["wx", "alerts", "health", "cal", "inbox", "tanda", "pay", "tt", "moodle", "ed", "ontrack", "notion", "github"];
  sources.sort((a, b) => order.indexOf(a.key.split(":")[0]) - order.indexOf(b.key.split(":")[0]));

  const base = {
    generatedAt: now.toISOString(),
    demo: false,
    today,
    health,
    coach: buildCoach(health, timeline, now),
    timeline,
    due,
    inbox: inboxAll,
    dev,
    ed: ed?.ed ?? null,
    sources,
    google: { connected: google.connected, refreshExpiresAt: google.refreshExpiresAt },
    weather,
    alerts: alerts ?? [],
    countdowns: getCountdowns(now),
    routine,
    usingPhoneLocation: loc.phone,
    workload,
    pay,
    why: health ? recoveryWhy(health) : null,
    accounts: google.accounts.map((a, i) => ({ email: a.email ?? (i === 0 ? primaryEmail : null), connected: a.connected, primary: i === 0 })),
  };
  return { ...base, brief: buildBrief(base, now) };
}

