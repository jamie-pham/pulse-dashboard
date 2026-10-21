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

// ---------- Hours + pay this pay period ----------
// Needs the "timesheet" scope (and "cost" for Tanda's own pay figures; otherwise PAY_RATE × hours).

export interface PayData {
  periodStart: string;
  periodEnd: string;
  workedHours: number;
  pay: number | null;
  payIsEstimate: boolean;
  upcomingHours: number;
  upcomingPay: number | null;
}

export function shiftHours(s: { start?: number | null; finish?: number | null; break_length?: number | null }): number {
  if (!s.start || !s.finish || s.finish <= s.start) return 0;
  return Math.max(0, (s.finish - s.start) / 3600 - (s.break_length ?? 0) / 60);
}

export async function getPay(upcoming: TimelineItem[]): Promise<PayData> {
  if (!cfg.tanda.token) throw new SourceError("off", "Add TANDA_TOKEN");
  const url = `${cfg.tanda.base}/timesheets/for/me/current`;
  const ts = await fetchJson<any>(`${url}?show_costs=true`, { headers: headers() }).catch(() =>
    fetchJson<any>(url, { headers: headers() }),
  );
  const shifts: any[] = ts?.shifts ?? [];
  const workedHours = Math.round(shifts.reduce((s, x) => s + shiftHours(x), 0) * 100) / 100;
  const tandaCost =
    typeof ts?.cost === "number"
      ? ts.cost
      : shifts.some((x) => typeof x.cost === "number")
        ? shifts.reduce((s, x) => s + (typeof x.cost === "number" ? x.cost : 0), 0)
        : null;
  const rate = cfg.tanda.payRate || (tandaCost && workedHours ? tandaCost / workedHours : 0);
  const pay = tandaCost ?? (cfg.tanda.payRate ? workedHours * cfg.tanda.payRate : null);

  const end = Date.parse(`${ts?.finish ?? ""}T23:59:59`) || Date.now() + 7 * 86400e3;
  const upcomingHours =
    Math.round(
      upcoming
        .filter((e) => e.source === "tanda" && Date.parse(e.start) > Date.now() && Date.parse(e.start) <= end)
        .reduce((s, e) => s + (Date.parse(e.end) - Date.parse(e.start)) / 3600e3, 0) * 100,
    ) / 100;

  return {
    periodStart: ts?.start ?? "",
    periodEnd: ts?.finish ?? "",
    workedHours,
    pay: pay == null ? null : Math.round(pay * 100) / 100,
    payIsEstimate: tandaCost == null,
    upcomingHours,
    upcomingPay: rate ? Math.round(upcomingHours * rate * 100) / 100 : null,
  };
}
