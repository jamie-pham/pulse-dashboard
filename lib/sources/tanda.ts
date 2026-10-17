// Play centre shifts from Tanda (Workforce.com).
// Token: Tanda → Settings/Profile → API → create a token with the "me" and "roster" scopes.
// (If your account can't see that page, see README for the password-grant alternative.)

import { cfg } from "../config";
import { fetchJson, SourceError } from "../errors";
import { cached } from "../store";
import type { TimelineItem } from "../types";

const headers = () => ({ Authorization: `bearer ${cfg.tanda.token}`, Accept: "application/json" });

export async function getShifts(fromDay: string, toDay: string): Promise<TimelineItem[]> {
  if (!cfg.tanda.token) throw new SourceError("off", "Add TANDA_TOKEN");
  const me = await cached("tanda:me", 86400, () => fetchJson<any>(`${cfg.tanda.base}/users/me`, { headers: headers() }));
  const u = new URL(`${cfg.tanda.base}/schedules`);
  u.searchParams.set("user_ids", String(me.id));
  u.searchParams.set("from", fromDay);
  u.searchParams.set("to", toDay);
  const schedules = await fetchJson<any[]>(u.toString(), { headers: headers() });
  return (schedules ?? [])
    .filter((s) => s.start && s.finish)
    .map((s) => ({
      id: `tanda:${s.id}`,
      title: "Shift",
      start: new Date(s.start * 1000).toISOString(),
      end: new Date(s.finish * 1000).toISOString(),
      allDay: false,
      source: "tanda" as const,
      location: s.department_name ?? undefined,
    }));
}
