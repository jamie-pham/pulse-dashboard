// Recovery and strain models.
//
// These are NOT Whoop's (or Fitbit's) proprietary algorithms — they're transparent approximations built from
// published methods so you can see and tweak exactly what's going on:
//   • Recovery: how last night's HRV, resting HR and sleep compare to YOUR rolling 30-day baseline.
//   • Strain:   Banister TRIMP (training impulse) from minute-level heart rate, mapped onto Whoop's 0–21 scale.
// Pure functions only — no I/O — so they're easy to test (see lib/__tests__).

import type { Band, RecoveryResult } from "./types";

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
}

export function sd(a: number[]): number {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function band(score: number): Band {
  return score >= 67 ? "green" : score >= 34 ? "yellow" : "red";
}

/** HRV is log-normally distributed, so its baseline is computed on ln(RMSSD). */
export function hrvBaseline(hist: number[]): number | null {
  const v = hist.filter((x) => x > 0);
  return v.length ? Math.exp(mean(v.map(Math.log))) : null;
}

export interface RecoveryInput {
  hrv: number | null; // last night's RMSSD, ms
  rhr: number | null; // resting HR, bpm
  sleepPerf: number | null; // 0..1 — sleep obtained / sleep needed
  hrvHist: number[]; // previous days only (not including the day being scored)
  rhrHist: number[];
}

const W = { hrv: 0.55, rhr: 0.2, sleep: 0.25 };

export function recoveryScore(i: RecoveryInput): RecoveryResult {
  const hrvHist = i.hrvHist.filter((x) => x > 0);
  const rhrHist = i.rhrHist.filter((x) => x > 0);
  const calibrating = hrvHist.length < 7;

  let zH: number | null = null;
  if (i.hrv && hrvHist.length >= 3) {
    const ln = hrvHist.map(Math.log);
    zH = clamp((Math.log(i.hrv) - mean(ln)) / Math.max(sd(ln) || 0, 0.06), -3, 3);
  }
  let zR: number | null = null;
  if (i.rhr && rhrHist.length >= 3) {
    zR = clamp(-(i.rhr - mean(rhrHist)) / Math.max(sd(rhrHist) || 0, 1.5), -3, 3);
  }
  const zS = i.sleepPerf != null ? clamp((i.sleepPerf - 0.85) / 0.1, -3, 1.5) : null;

  const parts: [number, number][] = [];
  if (zH != null) parts.push([zH, W.hrv]);
  if (zR != null) parts.push([zR, W.rhr]);
  if (zS != null) parts.push([zS, W.sleep]);
  if (!parts.length || (zH == null && zR == null)) {
    return { score: null, band: null, calibrating, components: { hrv: zH, rhr: zR, sleep: zS } };
  }
  const wSum = parts.reduce((s, [, w]) => s + w, 0);
  const composite = parts.reduce((s, [z, w]) => s + z * w, 0) / wSum;
  // Logistic map: an average night lands ~60, +1 SD ~80, -1 SD ~33.
  const score = Math.round(clamp(100 / (1 + Math.exp(-(1.3 * composite + 0.45))), 1, 99));
  return { score, band: band(score), calibrating, components: { hrv: zH, rhr: zR, sleep: zS } };
}

export interface StrainInput {
  hr: number[]; // per-minute average HR (gaps/off-wrist minutes already removed)
  rest: number;
  max: number;
  sex: "male" | "female";
}

/** Minutes below this fraction of heart-rate reserve are ignored (sitting, desk work, slow walking). */
export const STRAIN_FLOOR = 0.3;
/** TRIMP that lands at ~63% of the 0–21 scale (≈13.3). Tuned so a typical 60-min lifting session ≈ 10–12. */
export const STRAIN_K = 70;

export function trimp({ hr, rest, max, sex }: StrainInput) {
  const [a, b] = sex === "female" ? [0.86, 1.67] : [0.64, 1.92];
  const range = Math.max(max - rest, 30);
  const zones = [0, 0, 0, 0, 0];
  let total = 0;
  for (const bpm of hr) {
    if (!(bpm > 0)) continue;
    const x = (bpm - rest) / range;
    if (x >= 0.5) zones[Math.min(4, Math.floor((x - 0.5) / 0.1))] += 1;
    if (x < STRAIN_FLOOR) continue;
    const xc = Math.min(x, 1.05);
    total += xc * a * Math.exp(b * xc);
  }
  return { trimp: total, zones };
}

export function strainFromTrimp(t: number): number {
  return Math.round(21 * (1 - Math.exp(-Math.max(0, t) / STRAIN_K)) * 10) / 10;
}

/** Sleep need grows with yesterday's strain (up to +1h on a maxed-out day). */
export function sleepNeedMin(prevStrain: number | null, base = 480): number {
  const extra = prevStrain == null ? 0 : clamp((prevStrain - 10) * 6, 0, 60);
  return Math.round(base + extra);
}

export function sleepPerformance(asleepMin: number, needMin: number): number {
  return clamp(asleepMin / Math.max(needMin, 1), 0, 1);
}
