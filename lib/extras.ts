// Small personal-assistant bits: the morning routine checklist and countdowns.

import { cfg } from "./config";
import { store } from "./store";
import { ymd } from "./time";
import type { Countdown } from "./types";

const key = (day: string) => `routine:${day}`;

export async function getRoutine(day: string) {
  const done = (await store.get<string[]>(key(day)).catch(() => null)) ?? [];
  return { items: cfg.routine, done: done.filter((d) => cfg.routine.includes(d)) };
}

export async function setRoutineItem(day: string, item: string, done: boolean) {
  if (!cfg.routine.includes(item)) return getRoutine(day);
  const cur = new Set((await store.get<string[]>(key(day)).catch(() => null)) ?? []);
  if (done) cur.add(item);
  else cur.delete(item);
  await store.set(key(day), [...cur], 60 * 60 * 24 * 3);
  return getRoutine(day);
}

export function getCountdowns(now = new Date()): Countdown[] {
  const today = Date.parse(ymd(now));
  return cfg.countdowns
    .map((c) => ({ ...c, days: Math.round((Date.parse(c.date) - today) / 86400e3) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);
}
