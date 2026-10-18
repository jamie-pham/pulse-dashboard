// The "personal assistant" layer: turns everything on the dashboard into a short, time-aware brief —
// what matters this morning, for the rest of today, or tonight + tomorrow — plus a version that reads well aloud.

import { cfg } from "./config";
import { localHour } from "./coach";
import { addDays, fmtTime, ymd } from "./time";
import { travelFor } from "./travel";
import { wmo } from "./weather-advice";
import type { Brief, BriefLine, DashboardData, TimelineItem } from "./types";

type Input = Omit<DashboardData, "brief">;

/** 10:00am → 10am */
export const t = (iso: string | Date) => fmtTime(iso).replace(":00", "");

export function sayDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const hs = h === 1 ? "1 hour" : `${h} hours`;
  if (!h) return `${m} minutes`;
  return m ? `${hs} ${m} minutes` : hs;
}
const shortDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
};

/** Make display text sound natural through a speech engine (iOS Speak Text / Web Speech). */
export function forSpeech(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/(\w)\s?–\s?(\w)/g, "$1 to $2")
    .replace(/(-?\d+)°/g, "$1 degrees")
    .replace(/(\d+)%/g, "$1 percent")
    .replace(/km\/h/g, "kilometres an hour")
    .replace(/(\d)\s?km\b/g, "$1 kilometres")
    .replace(/(\d+)h (\d+)m\b/g, (_, h, m) => sayDuration(+h * 60 + +m))
    .replace(/\b(\d+)h\b/g, (_, h) => sayDuration(+h * 60))
    .replace(/\b(\d+)m\b/g, "$1 minutes")
    .replace(/\s*[—·|]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function leaveBy(e: TimelineItem, now: Date): { text: string; at: Date } | null {
  const mins = travelFor(e);
  if (!mins) return null;
  const at = new Date(Date.parse(e.start) - mins * 60e3);
  if (Date.parse(e.start) <= +now) return null;
  return { at, text: at <= now ? "leave now" : `leave by ${t(at)}` };
}

function eventLine(label: string, e: TimelineItem, now: Date): BriefLine {
  const where = e.source === "timetable" ? cfg.campus.label : e.location?.split(",")[0];
  const lb = leaveBy(e, now);
  const span = e.source === "tanda" ? `${t(e.start)}–${t(e.end)}` : `at ${t(e.start)}`;
  const icon = e.source === "tanda" ? "🧸" : e.source === "timetable" ? "🎓" : "📅";
  const text = `${label}: ${e.title} ${span}${where ? ` (${where})` : ""}${lb ? ` — ${lb.text}` : ""}.`;
  const say = `${label} is ${e.title} ${e.source === "tanda" ? `from ${t(e.start)} to ${t(e.end)}` : `at ${t(e.start)}`}${where ? ` at ${where}` : ""}${lb ? `. ${lb.text[0].toUpperCase()}${lb.text.slice(1)}` : ""}.`;
  return { icon, text, say };
}

function restOf(events: TimelineItem[], after: TimelineItem): string | null {
  const rest = events.filter((e) => !e.allDay && Date.parse(e.start) > Date.parse(after.start));
  if (!rest.length) return null;
  const last = rest.reduce((a, b) => (Date.parse(b.end) > Date.parse(a.end) ? b : a));
  return `Then ${rest.length} more — done around ${t(last.end)}.`;
}

function dueLines(d: Input, day: string, label: string): BriefLine[] {
  const items = d.due.filter((x) => ymd(new Date(x.due)) === day);
  if (!items.length) return [];
  const names = items.slice(0, 3).map((x) => x.title);
  const more = items.length > 3 ? ` +${items.length - 3} more` : "";
  return [{ icon: "📌", text: `Due ${label}: ${names.join(", ")}${more}.` }];
}

function weatherLine(d: Input): BriefLine[] {
  const w = d.weather;
  if (!w) return [];
  const { label } = wmo(w.now.code, w.now.isDay);
  const lines: BriefLine[] = [
    {
      icon: wmo(w.now.code, w.now.isDay).icon,
      text: `${w.now.temp}° and ${label.toLowerCase()}, heading to ${w.today.max}°.`,
      say: `It's ${w.now.temp}° and ${label.toLowerCase()}, heading to ${w.today.max}°.`,
      spokenOnly: true,
    },
  ];
  for (const a of w.advice.slice(0, 2)) lines.push({ icon: a.icon, text: `${a.text}.`, say: a.say ? `${a.say}.` : undefined });
  return lines;
}

function bodyLine(d: Input): BriefLine[] {
  const h = d.health;
  if (!h) return [];
  const r = h.recovery;
  const sleep = h.sleep;
  const slept = sleep ? ` Slept ${shortDur(sleep.asleepMin)} of ${shortDur(sleep.needMin)} needed.` : "";
  if (r.score == null) {
    return [
      {
        icon: "🫀",
        text: r.calibrating
          ? `Recovery is still calibrating — keep wearing the Air to bed.${slept}`
          : `Last night hasn't synced yet — open the Google Health app.${slept}`,
      },
    ];
  }
  const verdict = r.band === "green" ? "a good day to push" : r.band === "yellow" ? "train, but keep it controlled" : "take it easy today";
  return [
    {
      icon: r.band === "green" ? "💚" : r.band === "yellow" ? "💛" : "❤️",
      text: `Recovery ${r.score}% — ${verdict}.${slept}`,
      say: `Your recovery is ${r.score}%, ${r.band}: ${verdict}.${sleep ? ` You slept ${sayDuration(sleep.asleepMin)}${sleep.asleepMin < sleep.needMin - 20 ? `, about ${sayDuration(sleep.needMin - sleep.asleepMin)} short` : ""}.` : ""}`,
    },
  ];
}

function alertLines(d: Input): BriefLine[] {
  return d.alerts.slice(0, 2).map((a) => ({
    icon: "⚠️",
    text: `${a.title} ${a.distanceKm} km away${a.status ? ` (${a.status})` : ""} — check VicEmergency.`,
  }));
}

function countdownLines(d: Input): BriefLine[] {
  return d.countdowns
    .filter((c) => c.days >= 0 && c.days <= 14)
    .slice(0, 2)
    .map((c) => ({ icon: "⏳", text: c.days === 0 ? `${c.label} is today.` : `${c.label} in ${c.days} day${c.days === 1 ? "" : "s"}.` }));
}

export function buildBrief(d: Input, now = new Date()): Brief {
  const hour = localHour(now);
  const phase: Brief["phase"] = hour >= 4 && hour < 11 ? "morning" : hour < 17 && hour >= 11 ? "day" : hour >= 17 && hour < 23 ? "evening" : "night";
  const today = ymd(now);
  const tomorrow = addDays(today, 1);
  const upcoming = (list: TimelineItem[]) => list.filter((e) => !e.allDay && Date.parse(e.end) > +now);
  const lines: BriefLine[] = [];
  let title: string;
  let opener: string;

  if (phase === "morning" || phase === "day") {
    title = phase === "morning" ? "Your morning" : "Rest of today";
    opener = phase === "morning" ? `Good morning ${cfg.ownerName}.` : `Here's the rest of your day.`;
    lines.push(...weatherLine(d));
    if (d.weather?.campus && phase === "morning") {
      const c = d.weather.campus;
      lines.push({ icon: "🎓", text: `${c.label} at ${t(c.at)}: ${c.temp}°${c.pop >= 30 ? `, ${c.pop}% rain` : ""}.` });
    }
    if (phase === "morning") lines.push(...bodyLine(d));

    const evs = upcoming(d.timeline.today);
    const live = evs.find((e) => Date.parse(e.start) <= +now);
    const next = evs.find((e) => Date.parse(e.start) > +now);
    if (live) lines.push({ icon: "🟢", text: `Now: ${live.title} until ${t(live.end)}.` });
    if (next) {
      lines.push(eventLine(phase === "morning" && !live ? "First up" : "Next", next, now));
      const rest = restOf(evs, next);
      if (rest) lines.push({ icon: "🗓️", text: rest });
    } else if (!live) {
      lines.push({ icon: "🗓️", text: "Nothing else scheduled today." });
    }
    lines.push(...dueLines(d, today, "today"));
    if (phase === "morning") lines.push(...dueLines(d, tomorrow, "tomorrow"));
    lines.push(...countdownLines(d));
    lines.push(...alertLines(d));
    if (phase === "morning" && d.inbox?.unread) lines.push({ icon: "✉️", text: `${d.inbox.unread} unread email${d.inbox.unread === 1 ? "" : "s"}.` });
  } else {
    const smallHours = phase === "night" && hour < 4;
    const nextDay = smallHours ? today : tomorrow;
    const nextEvents = smallHours ? upcoming(d.timeline.today) : d.timeline.tomorrow.filter((e) => !e.allDay);
    title = phase === "evening" ? "Tonight & tomorrow" : "Before bed";
    opener = phase === "evening" ? `Evening ${cfg.ownerName}.` : `It's late, ${cfg.ownerName}.`;

    const tn = d.coach?.tonight;
    if (tn) {
      if (phase === "night") {
        const left = Math.max(0, (Date.parse(tn.wakeAt) - +now) / 60e3 - 15);
        lines.push({ icon: "🌙", text: `Bed now gets you ${shortDur(left)} before a ${t(tn.wakeAt)} wake (${tn.reason}).` });
      } else {
        lines.push({
          icon: "🌙",
          text: `In bed by ${t(tn.bedtime)} for ${shortDur(tn.needMin)} of sleep — wake ${t(tn.wakeAt)} (${tn.reason}).`,
        });
      }
    }
    const w = d.weather;
    const wd = smallHours ? w?.today : w?.tomorrow;
    if (wd) {
      const { icon, label } = wmo(wd.code);
      lines.push({
        icon,
        text: `${smallHours ? "Today" : "Tomorrow"}: ${label.toLowerCase()}, ${wd.min}–${wd.max}°${wd.pop >= 30 ? `, ${wd.pop}% chance of rain` : ""}.`,
        say: `${smallHours ? "Today" : "Tomorrow"} looks ${label.toLowerCase()}, ${wd.min} to ${wd.max}°${wd.pop >= 30 ? `, with a ${wd.pop}% chance of rain` : ""}.`,
      });
    }
    const first = nextEvents[0];
    if (first) {
      lines.push(eventLine(smallHours ? "First up today" : "First up tomorrow", first, now));
    } else {
      lines.push({ icon: "🗓️", text: `Nothing on ${smallHours ? "today" : "tomorrow"} — sleep in if you can.` });
    }
    lines.push(...dueLines(d, nextDay, smallHours ? "today" : "tomorrow"));
    lines.push(...countdownLines(d));
    lines.push(...alertLines(d));
  }

  const spoken = [opener, ...lines.map((l) => l.say ?? l.text)].map(forSpeech).join(" ");
  return { phase, title, lines, spoken };
}
