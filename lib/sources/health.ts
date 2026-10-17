// Fitbit Air data via the Google Health API (the replacement for the Fitbit Web API, which shuts off 30 Oct 2026).

import { cfg } from "../config";
import { gjson } from "../google";
import { store } from "../store";
import { addDays, dateParts, localTime, ymd, ymdFromParts } from "../time";
import {
  hrvBaseline,
  mean,
  recoveryScore,
  sleepNeedMin,
  sleepPerformance,
  strainFromTrimp,
  trimp,
} from "../scoring";
import type { HealthData } from "../types";

const BASE = "https://health.googleapis.com/v4/users/me/dataTypes";
const BASELINE_DAYS = 30;

async function listPoints(type: string, filter: string, maxPages = 6): Promise<any[]> {
  const out: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const u = new URL(`${BASE}/${type}/dataPoints`);
    u.searchParams.set("filter", filter);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const j = await gjson(u.toString());
    out.push(...(j.dataPoints ?? []));
    pageToken = j.nextPageToken || undefined;
    if (!pageToken) break;
  }
  return out;
}

async function rollUp(type: string, start: Date, end: Date, windowSize: string): Promise<any[]> {
  const out: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const j = await gjson(`${BASE}/${type}/dataPoints:rollUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range: { startTime: start.toISOString(), endTime: end.toISOString() },
        windowSize,
        dataSourceFamily: "users/me/dataSourceFamilies/google-wearables",
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    out.push(...(j.rollupDataPoints ?? []));
    pageToken = j.nextPageToken || undefined;
    if (!pageToken) break;
  }
  return out;
}

async function dailyRollUp(type: string, from: string, toExclusive: string): Promise<any[]> {
  const j = await gjson(`${BASE}/${type}/dataPoints:dailyRollUp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      range: { start: { date: dateParts(from) }, end: { date: dateParts(toExclusive) } },
      windowSizeDays: 1,
    }),
  });
  return j.rollupDataPoints ?? [];
}

/** { "2026-10-17": value } from a daily data type. */
async function dailySeries(type: string, field: string, pick: (o: any) => number | undefined, from: string) {
  const pts = await listPoints(type, `${type.replace(/-/g, "_")}.date >= "${from}"`);
  const out: Record<string, number> = {};
  for (const p of pts) {
    const o = p[field];
    const d = ymdFromParts(o?.date);
    const v = Number(pick(o));
    if (d && Number.isFinite(v) && v > 0) out[d] = v;
  }
  return out;
}

interface SleepNight {
  date: string; // local date of waking up
  start: string;
  end: string;
  asleepMin: number;
  inBedMin: number;
  stages: { deep: number; light: number; rem: number; awake: number };
  segments: { type: string; start: string; end: string }[];
  main: boolean;
}

async function sleepNights(from: string): Promise<Record<string, SleepNight>> {
  const pts = await listPoints("sleep", `sleep.interval.civil_end_time >= "${from}"`);
  const byDate: Record<string, SleepNight> = {};
  for (const p of pts) {
    const s = p.sleep;
    if (!s?.interval?.endTime) continue;
    const date = ymd(new Date(s.interval.endTime));
    const stages = { deep: 0, light: 0, rem: 0, awake: 0 };
    for (const st of s.summary?.stagesSummary ?? []) {
      const k = String(st.type).toLowerCase();
      const m = Number(st.minutes) || 0;
      if (k === "deep") stages.deep += m;
      else if (k === "light" || k === "asleep") stages.light += m;
      else if (k === "rem") stages.rem += m;
      else if (k === "awake" || k === "restless") stages.awake += m;
    }
    const inBed =
      Number(s.summary?.minutesInSleepPeriod) ||
      (Date.parse(s.interval.endTime) - Date.parse(s.interval.startTime)) / 60000;
    const night: SleepNight = {
      date,
      start: s.interval.startTime,
      end: s.interval.endTime,
      asleepMin: Number(s.summary?.minutesAsleep) || stages.deep + stages.light + stages.rem,
      inBedMin: Math.round(inBed),
      stages,
      segments: (s.stages ?? []).map((x: any) => ({ type: String(x.type), start: x.startTime, end: x.endTime })),
      main: Boolean(s.metadata?.mainSleep ?? s.metadata?.main ?? !s.metadata?.nap),
    };
    const prev = byDate[date];
    // keep the main / longest sleep per morning
    if (!prev || (night.main && !prev.main) || (night.main === prev.main && night.asleepMin > prev.asleepMin)) {
      byDate[date] = night;
    }
  }
  return byDate;
}

/** Strain for one local day from minute-level heart rate. Finished days are cached forever. */
async function strainForDay(day: string, rest: number, isToday: boolean) {
  const key = `strain:${day}`;
  if (!isToday) {
    const hit = await store.get<ReturnType<typeof summariseHr>>(key).catch(() => null);
    if (hit) return hit;
  }
  const start = localTime(day);
  const end = isToday ? new Date() : localTime(addDays(day, 1));
  const pts = await rollUp("heart-rate", start, end, "60s");
  const hr = pts.map((p) => Number(p.heartRate?.beatsPerMinuteAvg)).filter((x) => x > 0);
  const res = summariseHr(hr, rest);
  if (!isToday && hr.length > 60) await store.set(key, res).catch(() => {});
  return res;
}

function summariseHr(hr: number[], rest: number) {
  const { trimp: t, zones } = trimp({ hr, rest, max: cfg.body.hrMax, sex: cfg.body.sex });
  return {
    score: strainFromTrimp(t),
    trimp: Math.round(t * 10) / 10,
    zones,
    avgHr: hr.length ? Math.round(mean(hr)) : null,
    peakHr: hr.length ? Math.max(...hr) : null,
    minutesTracked: hr.length,
  };
}

export async function getHealth(): Promise<HealthData> {
  const today = ymd();
  const from = addDays(today, -(BASELINE_DAYS + 7));

  const [hrv, rhr, nights, steps, exercises] = await Promise.all([
    dailySeries("daily-heart-rate-variability", "dailyHeartRateVariability", (o) => o?.averageHeartRateVariabilityMilliseconds, from),
    dailySeries("daily-resting-heart-rate", "dailyRestingHeartRate", (o) => o?.beatsPerMinute, from),
    sleepNights(from),
    dailyRollUp("steps", today, addDays(today, 1)).catch(() => []),
    listPoints("exercise", `exercise.interval.civil_start_time >= "${today}"`, 1).catch(() => []),
  ]);

  const rhrValues = Object.values(rhr);
  const restHr = rhr[today] ?? rhr[addDays(today, -1)] ?? (rhrValues.length ? mean(rhrValues) : 60);

  // Strain: today + the previous 7 days (finished days come from cache after the first load).
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, -i));
  const strains = await Promise.all(
    days.map((d) => strainForDay(d, rhr[d] ?? restHr, d === today).catch(() => null)),
  );
  const strainByDay = Object.fromEntries(days.map((d, i) => [d, strains[i]]));

  const scoreDay = (d: string) => {
    const hist = (series: Record<string, number>) =>
      Array.from({ length: BASELINE_DAYS }, (_, i) => series[addDays(d, -(i + 1))]).filter((x) => x != null);
    const night = nights[d];
    const need = sleepNeedMin(strainByDay[addDays(d, -1)]?.score ?? null, cfg.body.baseSleepNeedMin);
    const perf = night ? sleepPerformance(night.asleepMin, need) : null;
    return {
      need,
      perf,
      night,
      hrvHist: hist(hrv),
      rhrHist: hist(rhr),
      result: recoveryScore({ hrv: hrv[d] ?? null, rhr: rhr[d] ?? null, sleepPerf: perf, hrvHist: hist(hrv), rhrHist: hist(rhr) }),
    };
  };

  // Today's HRV often lands a little after waking; fall back to the latest reading so the ring isn't blank.
  const dataDate = hrv[today] ? today : hrv[addDays(today, -1)] ? addDays(today, -1) : null;
  const t = scoreDay(dataDate ?? today);
  const tonightNight = nights[today] ?? null;
  const todayNeed = sleepNeedMin(strainByDay[addDays(today, -1)]?.score ?? null, cfg.body.baseSleepNeedMin);

  const strainToday = strainByDay[today] ?? summariseHr([], restHr);

  return {
    date: today,
    recovery: {
      ...t.result,
      hrv: dataDate ? hrv[dataDate] : null,
      hrvBaseline: t.hrvHist.length ? Math.round(hrvBaseline(t.hrvHist)! * 10) / 10 : null,
      rhr: dataDate ? (rhr[dataDate] ?? null) : null,
      rhrBaseline: t.rhrHist.length ? Math.round(mean(t.rhrHist) * 10) / 10 : null,
      dataDate,
    },
    strain: strainToday,
    sleep: tonightNight
      ? {
          asleepMin: tonightNight.asleepMin,
          inBedMin: tonightNight.inBedMin,
          needMin: todayNeed,
          performance: sleepPerformance(tonightNight.asleepMin, todayNeed),
          efficiency: tonightNight.inBedMin ? Math.min(1, tonightNight.asleepMin / tonightNight.inBedMin) : null,
          bedtime: tonightNight.start,
          wake: tonightNight.end,
          stages: tonightNight.stages,
          segments: tonightNight.segments,
        }
      : null,
    steps: Number(steps[0]?.steps?.countSum) || null,
    workouts: exercises
      .map((p: any) => p.exercise)
      .filter(Boolean)
      .map((e: any) => ({
        name: e.displayName ?? String(e.exerciseType ?? "Workout").replace(/_/g, " ").toLowerCase(),
        start: e.interval?.startTime,
        minutes: Math.round((parseFloat(e.activeDuration) || (Date.parse(e.interval?.endTime) - Date.parse(e.interval?.startTime)) / 1000) / 60),
        kcal: e.metricsSummary?.caloriesKcal ?? null,
        avgHr: Number(e.metricsSummary?.averageHeartRateBeatsPerMinute) || null,
      })),
    trend: days
      .slice()
      .reverse()
      .map((d) => {
        const s = scoreDay(d);
        return {
          date: d,
          recovery: s.result.score,
          strain: strainByDay[d]?.score ?? null,
          sleepHours: s.night ? Math.round((s.night.asleepMin / 60) * 10) / 10 : null,
        };
      }),
  };
}
