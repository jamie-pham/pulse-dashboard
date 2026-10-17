import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recoveryScore,
  trimp,
  strainFromTrimp,
  sleepNeedMin,
  sleepPerformance,
  hrvBaseline,
  band,
} from "../scoring";
import { addDays, localTime, ymd, tzOffsetMin } from "../time";

const hrvHist = [62, 58, 65, 60, 59, 63, 61, 57, 64, 60, 62, 58, 61, 63];
const rhrHist = [54, 55, 53, 54, 56, 54, 55, 53, 54, 55, 54, 53, 55, 54];

test("average night lands in the yellow-to-green middle", () => {
  const r = recoveryScore({ hrv: 60.5, rhr: 54.3, sleepPerf: 0.85, hrvHist, rhrHist });
  assert.ok(r.score! >= 55 && r.score! <= 66, `got ${r.score}`);
  assert.equal(r.calibrating, false);
});

test("high HRV, low RHR, full sleep → green", () => {
  const r = recoveryScore({ hrv: 72, rhr: 51, sleepPerf: 1, hrvHist, rhrHist });
  assert.equal(r.band, "green");
  assert.ok(r.score! >= 80, `got ${r.score}`);
});

test("crashed HRV, high RHR, short sleep → red", () => {
  const r = recoveryScore({ hrv: 42, rhr: 61, sleepPerf: 0.6, hrvHist, rhrHist });
  assert.equal(r.band, "red");
});

test("needs a baseline before scoring", () => {
  const r = recoveryScore({ hrv: 60, rhr: 55, sleepPerf: 0.9, hrvHist: [60], rhrHist: [55] });
  assert.equal(r.score, null);
  assert.equal(r.calibrating, true);
});

test("score stays within 1..99 for extreme inputs", () => {
  const hi = recoveryScore({ hrv: 500, rhr: 20, sleepPerf: 1, hrvHist, rhrHist });
  const lo = recoveryScore({ hrv: 5, rhr: 120, sleepPerf: 0, hrvHist, rhrHist });
  assert.ok(hi.score! <= 99 && lo.score! >= 1);
});

test("resting all day ≈ zero strain", () => {
  const hr = Array(900).fill(68); // 15 waking hours at desk HR
  const { trimp: t } = trimp({ hr, rest: 55, max: 195, sex: "male" });
  assert.equal(strainFromTrimp(t), 0);
});

test("60-min lifting session ≈ 9–13 strain", () => {
  const hr = [...Array(20).fill(110), ...Array(30).fill(130), ...Array(10).fill(150)];
  const { trimp: t } = trimp({ hr, rest: 55, max: 195, sex: "male" });
  const s = strainFromTrimp(t);
  assert.ok(s >= 9 && s <= 13, `got ${s} (trimp ${t.toFixed(1)})`);
});

test("hard 60-min run ≈ 15–19 strain and fills Z4", () => {
  const hr = Array(60).fill(172);
  const { trimp: t, zones } = trimp({ hr, rest: 55, max: 195, sex: "male" });
  const s = strainFromTrimp(t);
  assert.ok(s >= 15 && s <= 19, `got ${s}`);
  assert.equal(zones[3], 60);
});

test("strain is capped at 21", () => {
  assert.ok(strainFromTrimp(10_000) <= 21);
});

test("sleep need scales with yesterday's strain", () => {
  assert.equal(sleepNeedMin(null), 480);
  assert.equal(sleepNeedMin(8), 480);
  assert.equal(sleepNeedMin(15), 510);
  assert.equal(sleepNeedMin(21), 540);
  assert.equal(sleepPerformance(432, 480), 0.9);
  assert.equal(sleepPerformance(600, 480), 1);
});

test("HRV baseline is the geometric mean", () => {
  assert.equal(Math.round(hrvBaseline([40, 90])!), 60);
  assert.equal(band(67), "green");
  assert.equal(band(33), "red");
});

test("time helpers handle Melbourne DST", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  // 5 Oct 2026 is after DST starts (UTC+11)
  assert.equal(tzOffsetMin(new Date("2026-10-17T00:00:00Z"), "Australia/Melbourne"), 660);
  assert.equal(localTime("2026-10-17", "00:00", "Australia/Melbourne").toISOString(), "2026-10-16T13:00:00.000Z");
  assert.equal(ymd(new Date("2026-10-16T14:00:00Z"), "Australia/Melbourne"), "2026-10-17");
  // Winter: UTC+10
  assert.equal(localTime("2026-07-01", "07:30", "Australia/Melbourne").toISOString(), "2026-06-30T21:30:00.000Z");
});
