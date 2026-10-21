import { test } from "node:test";
import assert from "node:assert/strict";
import { weightOf, isDeadlineEcho, dayLoads, workloadHeadline, freeGaps, studyBlocks, spanLabel } from "../workload";
import { computeStreak } from "../extras";
import { urgentNotes, digestSlot, digestNote, inQuietHours } from "../notify";
import { emailFromIdToken } from "../google";
import { shiftHours } from "../sources/tanda";
import { accountLabel } from "../dashboard";
import { recoveryWhy } from "../coach";
import { dedupeEvents, mergeInboxes } from "../sources/google-apps";
import { demoData } from "../demo";
import { addDays, localTime, ymd } from "../time";
import type { DueItem, TimelineItem } from "../types";

const today = ymd();
const at = (day: string, hhmm: string) => localTime(day, hhmm);
const iso = (day: string, hhmm: string) => at(day, hhmm).toISOString();
const due = (id: string, title: string, day: string, hhmm = "23:55", course = "FIT1049"): DueItem => ({
  id,
  title,
  due: iso(day, hhmm),
  source: "moodle",
  course,
});
const ev = (id: string, title: string, day: string, a: string, b: string, source: TimelineItem["source"] = "calendar", location?: string): TimelineItem => ({
  id,
  title,
  start: iso(day, a),
  end: iso(day, b),
  allDay: false,
  source,
  location,
});

test("weights are read from Moodle titles", () => {
  assert.equal(weightOf("Quiz W11 [Individual | 0.6%]"), 0.6);
  assert.equal(weightOf("Assignment 3 Submission (15%)"), 15);
  assert.equal(weightOf("Workshop 10 lesson"), null);
});

test("a 10-min calendar copy of a Moodle deadline is recognised as an echo; real events aren't", () => {
  const d = [due("q", "Reflection W11 [Individual | 0.4%]", today)];
  assert.ok(isDeadlineEcho(ev("e1", "FIT1049 Reflection W11 [0.4%]", today, "23:45", "23:55"), d));
  assert.ok(!isDeadlineEcho(ev("e2", "FIT1049 Applied", today, "10:00", "12:00"), d));
  assert.ok(!isDeadlineEcho(ev("e3", "Reflection W11", today, "23:45", "23:55", "timetable"), d));
});

test("heatmap levels and headline", () => {
  const now = at(today, "09:00");
  const d4 = addDays(today, 4);
  const items = [
    due("a", "Assignment 3 [Group | 18%]", d4),
    due("b", "Assignment 3 Submission (15%)", d4, "23:55", "FIT1093"),
    due("c", "Quiz W11 [Individual | 0.6%]", addDays(today, 1)),
  ];
  const days = dayLoads(items, now);
  assert.equal(days.length, 14);
  assert.equal(days[4].count, 2);
  assert.equal(days[4].weight, 33);
  assert.equal(days[4].level, 4);
  assert.equal(days[1].level, 1);
  const h = workloadHeadline(days)!;
  assert.match(h.text, /^Heavy .*: 2 deadlines, 33% of grades$/);
  assert.equal(h.level, 4);
});

test("free gaps skip events plus travel; study block goes to the most urgent weighted task", () => {
  const now = at(today, "08:00");
  const events = [
    ev("c", "FIT1008 Applied", today, "10:00", "12:00", "timetable"), // +60 min travel each side → busy 9–13
    ev("m", "Anchor sync", today, "15:00", "15:30", "calendar", "Google Meet"), // online → no travel
  ];
  const gaps = freeGaps(events, now).filter((g) => ymd(new Date(g.start)) === today);
  // 8:30–9:00 is too short; 13:00–15:00 and 15:30–21:30 are free
  assert.equal(new Date(gaps[0].start).toISOString(), iso(today, "13:00"));
  assert.equal(new Date(gaps[0].end).toISOString(), iso(today, "15:00"));
  const blocks = studyBlocks(events, [due("small", "Quiz (1%)", addDays(today, 3)), due("big", "Assignment 3 (18%)", addDays(today, 3))], now);
  assert.equal(blocks[0].task.title, "Assignment 3 (18%)");
  assert.equal(blocks[0].start, iso(today, "13:00"));
  assert.equal(blocks[1].task.title, "Quiz (1%)"); // second window gets the next task, not the same one
  assert.equal(spanLabel(iso(today, "13:00"), iso(today, "15:00")), "1–3pm");
  assert.equal(spanLabel(iso(today, "11:00"), iso(today, "13:00")), "11am–1pm");
});

test("forgiving streak: one missed day a week is forgiven, two aren't; today never breaks it", () => {
  const h: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) h[addDays(today, -i)] = 3;
  h[addDays(today, -3)] = 0; // one miss
  let s = computeStreak(h, 4, today);
  assert.equal(s.days, 5);
  assert.equal(s.passUsed, true);
  h[addDays(today, -5)] = 0; // second miss within a week → the streak stops there (days -1, -2, -4 still count)
  s = computeStreak(h, 4, today);
  assert.equal(s.days, 3);
  h[today] = 2; // half done today counts
  assert.equal(computeStreak(h, 4, today).days, 4);
  // a long lapse reads as a fresh start, not a loss
  const old = { [addDays(today, -30)]: 4 };
  assert.deepEqual(computeStreak(old, 4, today), { days: 0, passUsed: false, freshStart: true });
  assert.deepEqual(computeStreak({}, 4, today), { days: 0, passUsed: false, freshStart: false });
});

test("urgent notifications: leave-by, closing deadline, nearby emergency", () => {
  const day = today;
  const timeline = { today: [ev("s", "Shift", day, "09:30", "16:00", "tanda", "Play centre")], tomorrow: [] };
  const d = {
    timeline,
    due: [due("q", "Quiz W11 [Individual | 0.6%]", day, "11:00"), due("later", "Assignment 3", addDays(day, 3))],
    alerts: [
      { id: "w1", kind: "warning" as const, title: "Watch and Act", detail: "Flood", status: "", distanceKm: 20, updated: "", url: "#" },
      { id: "i1", kind: "incident" as const, title: "Grass fire", detail: "", status: "Responding", distanceKm: 9, updated: "", url: "#" },
    ],
  };
  const n = urgentNotes(d, at(day, "08:50")); // shift 9:30, 30 min travel → leave 9:00 → alert from 8:45
  const ids = n.map((x) => x.id);
  assert.ok(ids.includes("leave:s"), ids.join());
  assert.equal(n.find((x) => x.id === "leave:s")!.title, "🚗 Leave in 10 min");
  assert.ok(ids.includes("due:q")); // 2h10m left
  assert.ok(!ids.includes("due:later"));
  assert.ok(ids.includes("alert:w1:")); // warnings at any distance in range
  assert.ok(!ids.some((x) => x.startsWith("alert:i1"))); // incidents only within 5 km
  assert.ok(!urgentNotes(d, at(day, "08:20")).some((x) => x.id === "leave:s")); // too early
});

test("digests: three slots, never in quiet hours, most actionable lines first", () => {
  assert.equal(digestSlot(at(today, "08:05")), "08:00");
  assert.equal(digestSlot(at(today, "08:59")), "08:00");
  assert.equal(digestSlot(at(today, "09:01")), null);
  assert.equal(digestSlot(at(today, "21:30")), "21:00");
  assert.ok(inQuietHours(at(today, "23:00")));
  assert.ok(inQuietHours(at(today, "06:30")));
  assert.ok(!inQuietHours(at(today, "07:00")));
  assert.equal(digestSlot(at(today, "08:10"), ["06:00", "08:00"]), "08:00");
  assert.equal(digestSlot(at(today, "06:10"), ["06:00"]), null); // inside quiet hours

  const data = demoData(at(today, "08:10"));
  const n = digestNote(data, "08:00", at(today, "08:10"))!;
  assert.equal(n.title, "Your morning");
  assert.equal(n.body.split("\n").length, 3);
  assert.ok(n.body.startsWith("⚠️"), n.body); // the emergency outranks the weather
});

test("account helpers", () => {
  const payload = Buffer.from(JSON.stringify({ email: "Jamie@Student.Monash.edu" })).toString("base64url");
  assert.equal(emailFromIdToken(`x.${payload}.y`), "jamie@student.monash.edu");
  assert.equal(emailFromIdToken("garbage"), undefined);
  assert.equal(accountLabel("jpha0042@student.monash.edu"), "monash");
  assert.equal(accountLabel("jamie.phamm1@gmail.com"), "jamie.phamm1");
  assert.equal(accountLabel("jamie@anchorapp.io"), "anchorapp");
});

test("shared calendars are de-duplicated; inboxes merge", () => {
  const a = { ...ev("1", "Lecture", today, "10:00", "11:00"), uid: "x@google|t" };
  const b = { ...ev("2", "Lecture", today, "10:00", "11:00"), uid: "x@google|t", account: "monash" };
  assert.equal(dedupeEvents([a, b]).length, 1);
  const m = mergeInboxes([
    { unread: 2, accounts: [{ email: "a@gmail.com", unread: 2 }], messages: [] },
    { unread: 5, accounts: [{ email: "b@monash.edu", unread: 5 }], messages: [] },
  ])!;
  assert.equal(m.unread, 7);
  assert.equal(m.accounts.length, 2);
});

test("Tanda hours subtract breaks; recovery explains itself", () => {
  assert.equal(shiftHours({ start: 0 + 1, finish: 1 + 6.5 * 3600, break_length: 30 }), 6);
  assert.equal(shiftHours({ start: 100, finish: null }), 0);
  const why = recoveryWhy(demoData(at(today, "07:05")).health!)!;
  assert.match(why, /HRV 10% above your normal/);
  assert.match(why, /short on sleep/);
});

test("brief includes a study window and the demo renders every new section", () => {
  const d = demoData(at(today, "07:05"));
  assert.ok(d.workload.days.length === 14);
  assert.ok(d.brief.lines.some((l) => l.kind === "study"), JSON.stringify(d.brief.lines.map((l) => l.text)));
  assert.ok(d.routine.streak.days >= 1);
});
