// Realistic fake data so you can see the whole dashboard before connecting anything (DEMO_MODE=1).

import { buildCoach } from "./coach";
import { addDays, localTime, ymd } from "./time";
import { recoveryScore, sleepPerformance, trimp, strainFromTrimp } from "./scoring";
import type { DashboardData, HealthData, TimelineItem } from "./types";

const at = (day: string, hhmm: string) => localTime(day, hhmm).toISOString();

export function demoData(): DashboardData {
  const now = new Date();
  const today = ymd(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  const hrvHist = [58, 61, 55, 63, 60, 57, 62, 59, 64, 56, 60, 61, 58, 63];
  const rhrHist = [56, 55, 57, 54, 55, 56, 54, 55, 53, 56, 55, 54, 56, 55];
  const asleep = 412;
  const need = 492;
  const rec = recoveryScore({ hrv: 66, rhr: 53, sleepPerf: sleepPerformance(asleep, need), hrvHist, rhrHist });

  // A morning gym session plus a day of walking around campus.
  const hr = [...Array(70).fill(102), ...Array(15).fill(118), ...Array(30).fill(134), ...Array(12).fill(152)];
  const s = trimp({ hr, rest: 53, max: 195, sex: "male" });

  const bed = at(yesterday, "23:34");
  const wake = at(today, "07:02");
  const seg = (type: string, from: number, to: number) => ({
    type,
    start: new Date(Date.parse(bed) + from * 60e3).toISOString(),
    end: new Date(Date.parse(bed) + to * 60e3).toISOString(),
  });
  const segments = [
    seg("AWAKE", 0, 9), seg("LIGHT", 9, 40), seg("DEEP", 40, 95), seg("LIGHT", 95, 140), seg("REM", 140, 165),
    seg("LIGHT", 165, 205), seg("DEEP", 205, 240), seg("LIGHT", 240, 290), seg("AWAKE", 290, 296), seg("REM", 296, 335),
    seg("LIGHT", 335, 380), seg("REM", 380, 420), seg("LIGHT", 420, 440), seg("AWAKE", 440, 448),
  ];

  const health: HealthData = {
    date: today,
    recovery: { ...rec, hrv: 66, hrvBaseline: 59.8, rhr: 53, rhrBaseline: 55.1, dataDate: today },
    strain: {
      score: strainFromTrimp(s.trimp),
      trimp: Math.round(s.trimp),
      zones: s.zones,
      avgHr: 84,
      peakHr: 163,
      minutesTracked: 690,
    },
    sleep: {
      asleepMin: asleep,
      inBedMin: 448,
      needMin: need,
      performance: sleepPerformance(asleep, need),
      efficiency: asleep / 448,
      bedtime: bed,
      wake,
      stages: { deep: 90, light: 231, rem: 91, awake: 23 },
      segments,
    },
    steps: 8412,
    workouts: [{ name: "Weights", start: at(today, "08:15"), minutes: 68, kcal: 412, avgHr: 128 }],
    trend: [
      { d: -6, r: 54, s: 12.1, h: 7.1 }, { d: -5, r: 71, s: 8.4, h: 7.8 }, { d: -4, r: 38, s: 14.6, h: 6.2 },
      { d: -3, r: 47, s: 6.9, h: 7.4 }, { d: -2, r: 82, s: 13.2, h: 8.1 }, { d: -1, r: 63, s: 10.8, h: 7.0 },
      { d: 0, r: rec.score, s: strainFromTrimp(s.trimp), h: asleep / 60 },
    ].map((x) => ({ date: addDays(today, x.d), recovery: x.r, strain: x.s, sleepHours: Math.round(x.h * 10) / 10 })),
  };

  const ev = (id: string, title: string, day: string, a: string, b: string, source: TimelineItem["source"], location?: string): TimelineItem => ({
    id, title, start: at(day, a), end: at(day, b), allDay: false, source, location,
  });
  const timeline = {
    today: [
      ev("t1", "FIT1008 Applied", today, "10:00", "12:00", "timetable", "Clayton · Learning & Teaching 132"),
      ev("c1", "Anchor sync", today, "13:00", "13:30", "calendar", "Google Meet"),
      ev("t2", "FIT1093 Workshop", today, "14:00", "16:00", "timetable", "Clayton · Woodside G03"),
      ev("c2", "Gym — legs", today, "18:00", "19:15", "calendar", "Revo Fitness"),
    ],
    tomorrow: [
      ev("s1", "Shift", tomorrow, "09:30", "16:00", "tanda", "Play centre"),
      ev("c3", "Dinner", tomorrow, "18:30", "20:30", "calendar"),
    ],
  };

  const due = (d: number, hhmm: string) => at(addDays(today, d), hhmm);
  return {
    generatedAt: now.toISOString(),
    demo: true,
    today,
    health,
    coach: buildCoach(health, timeline, now),
    timeline,
    due: [
      { id: "d1", title: "P6 · Linked lists", due: due(1, "23:59"), source: "ontrack", course: "FIT1008", status: "working on it" },
      { id: "d2", title: "Week 11 quiz", due: due(2, "23:55"), source: "moodle", course: "NUT1011" },
      { id: "d3", title: "Assignment 2 — Block cipher modes", due: due(4, "23:55"), source: "moodle", course: "FIT1093" },
      { id: "d4", title: "Workshop 10 lesson", due: due(5, "17:00"), source: "ed", course: "FIT1008" },
      { id: "d5", title: "Ship Anchor push-alert retry", due: due(6, "23:59"), source: "notion", status: "In progress" },
      { id: "d6", title: "Security+ practice test 3", due: due(9, "23:59"), source: "notion", status: "Not started" },
    ],
    inbox: {
      unread: 7,
      messages: [
        { id: "m1", from: "Monash Connect", subject: "Semester 2 exam timetable now available", url: "#" },
        { id: "m2", from: "Western Chances", subject: "Internship placements — next steps", url: "#" },
        { id: "m3", from: "GitHub", subject: "[anchor] Review requested on #142", url: "#" },
      ],
    },
    dev: {
      login: "jamie",
      myPrs: [{ title: "Retry failed push deliveries with backoff", repo: "anchor/anchor-app", number: 141, url: "#", updated: now.toISOString() }],
      reviewRequests: [{ title: "Bushfire zone polygons from VicEmergency feed", repo: "anchor/anchor-app", number: 142, url: "#", updated: now.toISOString() }],
      issues: [
        { title: "Android: alert sound ignores Do Not Disturb override", repo: "anchor/anchor-app", number: 133, url: "#", updated: now.toISOString() },
      ],
    },
    ed: {
      announcements: [
        { id: "a1", title: "Hurdle test — room allocations", course: "FIT1008", at: new Date(+now - 20 * 3600e3).toISOString(), url: "#" },
      ],
    },
    sources: [
      { key: "health", label: "Fitbit Air", state: "ok" },
      { key: "cal", label: "Google Calendar", state: "ok" },
      { key: "inbox", label: "Gmail", state: "ok" },
      { key: "tanda", label: "Tanda", state: "ok" },
      { key: "tt", label: "Timetable", state: "ok" },
      { key: "moodle", label: "Moodle", state: "ok" },
      { key: "ed", label: "Ed", state: "ok" },
      { key: "ontrack", label: "OnTrack", state: "reconnect", message: "Token expired — copy a fresh one" },
      { key: "notion", label: "Notion", state: "ok" },
      { key: "github", label: "GitHub", state: "ok" },
    ],
    google: { connected: true, refreshExpiresAt: new Date(+now + 4 * 86400e3).toISOString() },
  };
}
