// Small personal-assistant bits: the morning routine (with a forgiving streak) and countdowns.

import { cfg } from "./config";
import { store } from "./store";
import { addDays, ymd } from "./time";
import type { Countdown } from "./types";

const key = (day: string) => `routine:${day}`;
const HISTORY = "routine:history"; // { "2026-10-21": 3, ... } — items ticked per day

export interface Streak {
  days: number;
  passUsed: boolean; // a missed day in the last week was forgiven
  freshStart: boolean; // there's history, but no current streak — framed as a fresh start, never as "streak lost"
}

/**
 * Forgiving streak (Duolingo-style): a day counts if at least half the routine was ticked;
 * one missed day per rolling week is forgiven (shifts, sick days); today never breaks it until it's over.
 */
export function computeStreak(history: Record<string, number>, items: number, today: string): Streak {
  const need = Math.max(1, Math.ceil(items / 2));
  const ok = (d: string) => (history[d] ?? 0) >= need;
  const first = Object.keys(history).sort()[0];
  if (!first) return { days: 0, passUsed: false, freshStart: false };
  let days = ok(today) ? 1 : 0; // today only adds — it can't break the streak until it's over
  let lastForgiven: string | null = null;
  for (let i = 0, cur = addDays(today, -1); i < 400 && cur >= first; i++, cur = addDays(cur, -1)) {
    if (ok(cur)) {
      days++;
      continue;
    }
    // A miss: forgiven unless another miss was already forgiven within 7 days of it.
    if (lastForgiven && Date.parse(lastForgiven) - Date.parse(cur) < 7 * 86400e3) break;
    lastForgiven = cur;
  }
  if (days === 0) lastForgiven = null;
  const passUsed = Boolean(lastForgiven && Date.parse(today) - Date.parse(lastForgiven) < 7 * 86400e3);
  return { days, passUsed, freshStart: days === 0 && Boolean(first) };
}

export async function getRoutine(day: string) {
  const [done, history] = await Promise.all([
    store.get<string[]>(key(day)).catch(() => null),
    store.get<Record<string, number>>(HISTORY).catch(() => null),
  ]);
  return {
    items: cfg.routine,
    done: (done ?? []).filter((d) => cfg.routine.includes(d)),
    streak: computeStreak(history ?? {}, cfg.routine.length, day),
  };
}

export async function setRoutineItem(day: string, item: string, done: boolean) {
  if (!cfg.routine.includes(item)) return getRoutine(day);
  const cur = new Set((await store.get<string[]>(key(day)).catch(() => null)) ?? []);
  if (done) cur.add(item);
  else cur.delete(item);
  await store.set(key(day), [...cur], 60 * 60 * 24 * 3);
  const history = (await store.get<Record<string, number>>(HISTORY).catch(() => null)) ?? {};
  history[day] = [...cur].filter((x) => cfg.routine.includes(x)).length;
  // keep ~4 months
  for (const k of Object.keys(history)) if (k < addDays(day, -120)) delete history[k];
  await store.set(HISTORY, history);
  return getRoutine(day);
}

export function getCountdowns(now = new Date()): Countdown[] {
  const today = Date.parse(ymd(now));
  return cfg.countdowns
    .map((c) => ({ ...c, days: Math.round((Date.parse(c.date) - today) / 86400e3) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);
}
