import { cfg } from "./config";
import type { TimelineItem } from "./types";

const ONLINE = /zoom|meet\.google|google meet|teams|online|webex|discord/i;
const CAMPUS = /monash|clayton|caulfield|woodside|learning & teaching|menzies|campus centre/i;

/** Door-to-door minutes to get to an event. 0 = online, nothing to travel to. */
export function travelFor(e: TimelineItem): number {
  const where = `${e.location ?? ""} ${e.title}`;
  if (ONLINE.test(where)) return 0;
  if (e.source === "timetable" || CAMPUS.test(where)) return cfg.travel.campusMin;
  if (e.source === "tanda") return cfg.travel.shiftMin;
  if (!e.location) return 0; // reminders / blocks without a place
  return cfg.travel.otherMin;
}

export const isCampus = (e: TimelineItem) => e.source === "timetable" || CAMPUS.test(`${e.location ?? ""} ${e.title}`);
