import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWidget, shortTitle } from "../widget";
import { demoData } from "../demo";
import { localTime, ymd } from "../time";

const today = ymd();

test("titles are trimmed for the lock screen", () => {
  assert.equal(shortTitle("Assignment 3 [Group | 18%]"), "Assignment 3");
  assert.equal(shortTitle("Assignment 3 Submission (15%)"), "Assignment 3");
  assert.equal(shortTitle("FIT1008 Applied"), "FIT1008 Applied");
});

test("widget feed: upcoming events with leave-by, future deadlines only, no email content", () => {
  const now = localTime(today, "07:05");
  const f = buildWidget(demoData(now), now);
  assert.equal(f.v, 1);
  assert.ok(f.weather && Number.isInteger(f.weather.temp));
  assert.ok(f.events.length > 0);
  assert.ok(f.events.every((e) => Date.parse(e.end) > +now), "past events dropped");
  for (let i = 1; i < f.events.length; i++) assert.ok(Date.parse(f.events[i].start) >= Date.parse(f.events[i - 1].start));
  const travelled = f.events.find((e) => e.leaveAt);
  assert.ok(travelled && Date.parse(travelled.leaveAt!) < Date.parse(travelled.start));
  assert.ok(f.due.every((d) => Date.parse(d.due) > +now));
  assert.ok(f.lines.length <= 3 && f.lines.every((l) => l.kind !== "inbox"));
  const json = JSON.stringify(f);
  assert.ok(!/@|mail\.google/.test(json), "nothing from the inbox leaks onto the lock screen");
});

test("no 'leave by' between back-to-back campus classes", async () => {
  const { travelFrom } = await import("../travel");
  const iso = (h: string) => localTime(today, h).toISOString();
  const a = { id: "a", title: "FIT1008 Applied", start: iso("10:00"), end: iso("12:00"), allDay: false, source: "timetable" as const };
  const b = { id: "b", title: "FIT1093 Workshop", start: iso("14:00"), end: iso("16:00"), allDay: false, source: "timetable" as const };
  const gym = { id: "g", title: "Gym", start: iso("18:00"), end: iso("19:00"), allDay: false, source: "calendar" as const, location: "Revo Fitness" };
  assert.equal(travelFrom(a, [a, b, gym]), 60);
  assert.equal(travelFrom(b, [a, b, gym]), 0);
  assert.equal(travelFrom(gym, [a, b, gym]), 30);
});

test("every time in the feed is UTC ISO with milliseconds (the Swift decoder relies on it)", () => {
  const now = localTime(today, "07:05");
  const f = buildWidget(demoData(now), now);
  const isoRe = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
  const times = [f.generatedAt, ...f.events.flatMap((e) => [e.start, e.end, e.leaveAt]), ...f.due.map((d) => d.due), f.weather?.rainAt, f.study?.start, f.study?.end].filter(Boolean) as string[];
  for (const t of times) assert.match(t, isoRe);
});

test("only official warnings take the top slot; a nearby incident doesn't", () => {
  const now = localTime(today, "07:05");
  const d = demoData(now);
  assert.equal(buildWidget({ ...d, alerts: d.alerts.filter((a) => a.kind === "incident") }, now).alert, null);
  const warning = { id: "w", kind: "warning" as const, title: "Emergency Warning", detail: "Bushfire", status: "", distanceKm: 12, updated: "", url: "#" };
  assert.equal(buildWidget({ ...d, alerts: [warning] }, now).alert?.title, "Emergency Warning");
});
