import { cfg } from "./config";
import type { TimelineItem } from "./types";

const ONLINE = /zoom|meet\.google|google meet|teams|online|webex|discord/i;
const CAMPUS = /monash|clayton|caulfield|woodside|learning & teaching|menzies|campus centre|\bCL_|\bCA_/i;
const SHIFT = /^work\b|^shift\b|superpark/i;

/** Door-to-door minutes to get to an event. 0 = online, nothing to travel to. */
export function travelFor(e: TimelineItem): number {
  const where = `${e.location ?? ""} ${e.title}`;
  if (ONLINE.test(where)) return 0;
  if (e.source === "timetable" || CAMPUS.test(where)) return cfg.travel.campusMin;
  if (e.source === "tanda" || SHIFT.test(e.title) || SHIFT.test(e.location ?? "")) return cfg.travel.shiftMin;
  if (!e.location) return 0; // reminders / blocks without a place
  return cfg.travel.otherMin;
}

export const isCampus = (e: TimelineItem) => e.source === "timetable" || CAMPUS.test(`${e.location ?? ""} ${e.title}`);

/**
 * Travel time for an event given the rest of the day: 0 if you'll already be there — the previous event was
 * on campus and ended within 4 hours (you stay between classes), or it was at the same place.
 */
export function travelFrom(e: TimelineItem, day: TimelineItem[]): number {
  const mins = travelFor(e);
  if (!mins) return 0;
  const start = Date.parse(e.start);
  const prev = day
    .filter((x) => !x.allDay && x.id !== e.id && Date.parse(x.end) <= start && start - Date.parse(x.end) <= 4 * 3600e3)
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0];
  if (!prev) return mins;
  if (isCampus(e) && isCampus(prev)) return 0;
  if (e.location && prev.location && e.location.trim().toLowerCase() === prev.location.trim().toLowerCase()) return 0;
  return mins;
}
