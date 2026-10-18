import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherAdvice, wmo } from "../weather-advice";
import { forSpeech, sayDuration } from "../brief";
import { pickAlerts } from "../sources/alerts";
import { travelFor } from "../travel";
import { demoData } from "../demo";
import { localTime, ymd } from "../time";
import type { WeatherHour } from "../types";

const hour = (h: number, o: Partial<WeatherHour> = {}): WeatherHour => ({
  time: localTime(ymd(), `${String(h).padStart(2, "0")}:00`).toISOString(),
  temp: 15,
  feels: 14,
  code: 2,
  pop: 0,
  uv: 0,
  isDay: true,
  ...o,
});
const today = { date: ymd(), code: 2, max: 18, min: 9, pop: 0, rainMm: 0, uvMax: 2, sunrise: "", sunset: "" };

test("rain later → umbrella with the time it starts", () => {
  const a = weatherAdvice({
    now: { temp: 12, feels: 11, code: 2, gust: 20 },
    hours: [hour(8), hour(12, { pop: 30 }), hour(15, { pop: 70 })],
    today,
    aqi: 20,
  });
  assert.ok(a.some((x) => x.icon === "☂️" && x.text.includes("70%") && x.text.includes("3pm")), JSON.stringify(a));
});

test("cold morning → jacket; high UV → sunscreen; calm, clean air → nothing else", () => {
  const a = weatherAdvice({
    now: { temp: 8, feels: 6, code: 0, gust: 15 },
    hours: [hour(7, { feels: 6, temp: 8 }), hour(13, { temp: 21, feels: 21, uv: 8.4 })],
    today: { ...today, max: 21 },
    aqi: 15,
  });
  const icons = a.map((x) => x.icon);
  assert.ok(icons.includes("🧥") && icons.includes("🧴"), JSON.stringify(a));
  assert.ok(a.find((x) => x.icon === "🧴")!.text.includes("very high"));
  assert.ok(!icons.includes("☂️") && !icons.includes("💨") && !icons.includes("😷"));
});

test("WMO codes map to labels and night icons", () => {
  assert.equal(wmo(0, false).icon, "🌙");
  assert.equal(wmo(81).label, "Showers");
  assert.equal(wmo(95).icon, "⛈️");
});

test("speech text: no emoji, units spoken out", () => {
  assert.equal(
    forSpeech("☂️ 11° and 70% rain — gusts 50 km/h, 9:30am–4pm. Slept 6h 52m."),
    "11 degrees and 70 percent rain, gusts 50 kilometres an hour, 9:30am to 4pm. Slept 6 hours 52 minutes.",
  );
  assert.equal(sayDuration(60), "1 hour");
  assert.equal(sayDuration(45), "45 minutes");
});

test("VicEmergency: nearby active incidents and warnings only", () => {
  const pt = (lon: number, lat: number) => ({ type: "Point", coordinates: [lon, lat] });
  const home = { lat: -37.835, lon: 144.73 };
  const features = [
    { properties: { feedType: "incident", category1: "Fire", category2: "Grass", status: "Responding", location: "Near" }, geometry: pt(144.75, -37.84) },
    { properties: { feedType: "incident", category1: "Fire", category2: "Grass", status: "Safe" }, geometry: pt(144.75, -37.84) },
    { properties: { feedType: "incident", category1: "Fire", category2: "Grass", status: "Responding" }, geometry: pt(146.5, -38.2) },
    { properties: { feedType: "burn-area", category1: "Burn Area", status: "Unknown" }, geometry: pt(144.74, -37.83) },
    {
      properties: { feedType: "warning", name: "Watch and Act", category2: "Flood", sourceId: "123" },
      geometry: { type: "Polygon", coordinates: [[[144.9, -37.9], [145.0, -37.9], [145.0, -38.0], [144.9, -37.9]]] },
    },
  ];
  const a = pickAlerts(features, home.lat, home.lon, 15);
  assert.equal(a.length, 2);
  assert.equal(a[0].kind, "warning");
  assert.ok(a[0].url.includes("/warning/123/"));
  assert.ok(a[1].distanceKm < 3);
});

test("travel time by kind of event", () => {
  const base = { id: "x", start: "", end: "", allDay: false };
  assert.equal(travelFor({ ...base, title: "FIT1008", source: "timetable" }), 60);
  assert.equal(travelFor({ ...base, title: "Shift", source: "tanda" }), 30);
  assert.equal(travelFor({ ...base, title: "Anchor sync", source: "calendar", location: "Google Meet" }), 0);
  assert.equal(travelFor({ ...base, title: "Dentist", source: "calendar", location: "12 Main St" }), 30);
});

test("brief adapts to the time of day", () => {
  const morning = demoData(localTime(ymd(), "07:05")).brief;
  assert.equal(morning.phase, "morning");
  assert.ok(morning.spoken.startsWith("Good morning"));
  assert.ok(morning.lines.some((l) => l.text.includes("First up: FIT1008 Applied at 10am (Clayton) — leave by 9am")), JSON.stringify(morning.lines));
  assert.ok(!/\p{Extended_Pictographic}/u.test(morning.spoken), "spoken text must not contain emoji");
  assert.ok(morning.spoken.includes("degrees"));

  const evening = demoData(localTime(ymd(), "20:30")).brief;
  assert.equal(evening.phase, "evening");
  assert.ok(evening.lines.some((l) => l.text.startsWith("First up tomorrow: Shift 9:30am–4pm")), JSON.stringify(evening.lines));
  assert.ok(evening.lines.some((l) => l.text.startsWith("In bed by")));

  assert.equal(demoData(localTime(ymd(), "13:00")).brief.phase, "day");
});
