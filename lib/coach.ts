// Turns the numbers into a couple of plain-English lines for the top of the dashboard.
// Simple rules, on purpose — easy to read, easy to change.

import { cfg } from "./config";
import { addDays, fmtDuration, fmtTime, localTime, ymd } from "./time";
import { sleepNeedMin } from "./scoring";
import type { Coach, HealthData, TimelineItem } from "./types";

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
  const tomorrowDay = addDays(ymd(now), 1);
  const first = timeline.tomorrow.find((e) => !e.allDay);
  let wake = localTime(tomorrowDay, cfg.body.defaultWake);
  let reason = `your usual ${cfg.body.defaultWake} wake`;
  if (first) {
    const travel = first.source === "tanda" ? 60 : 75; // commute + getting ready, minutes
    const byFirst = new Date(Date.parse(first.start) - travel * 60e3);
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
