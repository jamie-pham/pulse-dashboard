// Turns the numbers into a couple of plain-English lines for the top of the dashboard.
// Simple rules, on purpose — easy to read, easy to change.

import { cfg } from "./config";
import { addDays, fmtDuration, fmtTime, localTime, ymd } from "./time";
import { sleepNeedMin } from "./scoring";
import { travelFor } from "./travel";
import type { Coach, HealthData, TimelineItem } from "./types";

export function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-AU", { timeZone: cfg.tz, hour: "numeric", hourCycle: "h23" }).format(d));
}

/** Every score shows its reasons: "HRV 8% below your normal · 1h 20m short on sleep · resting HR normal", biggest factor first. */
export function recoveryWhy(h: HealthData): string | null {
  const r = h.recovery;
  if (r.score == null) return null;
  const parts: { z: number; txt: string }[] = [];
  if (r.hrv && r.hrvBaseline) {
    const pct = Math.round((r.hrv / r.hrvBaseline - 1) * 100);
    parts.push({ z: Math.abs(r.components.hrv ?? 0) + 0.01, txt: Math.abs(pct) < 4 ? "HRV normal" : `HRV ${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} your normal` });
  }
  if (r.rhr && r.rhrBaseline) {
    const d = Math.round(r.rhr - r.rhrBaseline);
    parts.push({ z: Math.abs(r.components.rhr ?? 0), txt: Math.abs(d) < 2 ? "resting HR normal" : `resting HR ${Math.abs(d)} bpm ${d > 0 ? "higher" : "lower"} than usual` });
  }
  if (h.sleep) {
    const short = h.sleep.needMin - h.sleep.asleepMin;
    parts.push({ z: Math.abs(r.components.sleep ?? 0), txt: short > 20 ? `${fmtDuration(short)} short on sleep` : "sleep on target" });
  }
  return parts.length ? parts.sort((a, b) => b.z - a.z).map((p) => p.txt).join(" · ") : null;
}

export function buildCoach(
  h: HealthData | null,
  timeline: { today: TimelineItem[]; tomorrow: TimelineItem[] },
  now = new Date(),
): Coach | null {
  if (!h) return null;
  const lines: string[] = [];
  const rec = h.recovery.score;

  let headline: string;
  if (rec == null) {
    headline = h.recovery.calibrating ? "Building your baseline" : "Waiting on last night's data";
    lines.push(
      h.recovery.calibrating
        ? "Recovery needs about a week of nights to learn your normal HRV and resting HR. Keep wearing the Air to bed."
        : "Your Fitbit hasn't synced last night's HRV yet — open the Google Health app to nudge it.",
    );
  } else if (rec >= 67) {
    headline = "Green light — push today";
    lines.push("Good day for heavy compounds or a harder run. Your body's absorbed recent load well.");
  } else if (rec >= 34) {
    headline = "Train, but keep it controlled";
    lines.push("Do the session, cap it around RPE 8 and skip the grinders. Moderate recovery isn't a reason to skip.");
  } else {
    headline = "Recovery is low — go easy";
    lines.push("Swap heavy lifting for mobility or an easy zone-2 walk. Prioritise food and an early night.");
  }

  // What's already on the plate today
  const shift = timeline.today.find((e) => e.source === "tanda");
  if (shift) {
    const hrs = (Date.parse(shift.end) - Date.parse(shift.start)) / 3600e3;
    if (Date.parse(shift.end) > +now) {
      lines.push(`Shift ${fmtTime(shift.start)}–${fmtTime(shift.end)} (${hrs.toFixed(1)}h on your feet) — count that as load.`);
    }
  }
  const classes = timeline.today.filter((e) => e.source === "timetable" && Date.parse(e.end) > +now).length;
  if (classes) lines.push(`${classes} class${classes > 1 ? "es" : ""} still to go today.`);

  if (h.sleep && h.sleep.performance < 0.8) {
    lines.push(
      `You got ${fmtDuration(h.sleep.asleepMin)} of the ${fmtDuration(h.sleep.needMin)} you needed — that debt is part of today's score.`,
    );
  }

  // Tonight's bedtime: work back from tomorrow's first commitment.
  const needTonight = sleepNeedMin(h.strain.score, cfg.body.baseSleepNeedMin);
  // After midnight, "tonight" is really this morning.
  const smallHours = localHour(now) < 4;
  const wakeDay = smallHours ? ymd(now) : addDays(ymd(now), 1);
  const first = (smallHours ? timeline.today : timeline.tomorrow).find((e) => !e.allDay && Date.parse(e.start) > +now);
  let wake = localTime(wakeDay, cfg.body.defaultWake);
  let reason = "your usual wake time";
  if (first) {
    const lead = travelFor(first) + cfg.travel.readyMin;
    const byFirst = new Date(Date.parse(first.start) - lead * 60e3);
    if (byFirst < wake) {
      wake = byFirst;
      reason = `${first.title} at ${fmtTime(first.start)}`;
    }
  }
  const bedtime = new Date(+wake - (needTonight + 15) * 60e3); // +15 min to fall asleep

  return {
    headline,
    lines,
    tonight: { bedtime: bedtime.toISOString(), wakeAt: wake.toISOString(), needMin: needTonight, reason },
  };
}
