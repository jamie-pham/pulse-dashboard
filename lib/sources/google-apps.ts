// Google Calendar + Gmail, for the primary account and any extra accounts you've added.

import { cfg } from "../config";
import { gjson, PRIMARY, type Slot } from "../google";
import type { InboxData, TimelineItem } from "../types";

/** Which calendars to read for an account: GOOGLE_CALENDAR_IDS for the primary if set, else every calendar ticked in Google Calendar. */
async function calendarsFor(slot: Slot): Promise<string[]> {
  if (slot === PRIMARY && cfg.google.calendarIds.length) return cfg.google.calendarIds;
  const j = await gjson("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50", {}, slot);
  const ids = (j.items ?? [])
    .filter((c: any) => c.primary || (c.selected && !c.hidden))
    .filter((c: any) => !/#holiday@group|#contacts@group|addressbook#/i.test(c.id))
    .map((c: any) => c.id as string);
  return ids.length ? ids : ["primary"];
}

export async function getCalendar(from: Date, to: Date, slot: Slot = PRIMARY, label?: string): Promise<TimelineItem[]> {
  const ids = await calendarsFor(slot);
  const all = await Promise.all(
    ids.map(async (calId) => {
      const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
      u.searchParams.set("timeMin", from.toISOString());
      u.searchParams.set("timeMax", to.toISOString());
      u.searchParams.set("singleEvents", "true");
      u.searchParams.set("orderBy", "startTime");
      u.searchParams.set("maxResults", "50");
      const j = await gjson(u.toString(), {}, slot).catch(() => ({ items: [] }));
      return (j.items ?? [])
        .filter((e: any) => e.status !== "cancelled" && e.eventType !== "workingLocation")
        .filter((e: any) => !(e.attendees ?? []).some((a: any) => a.self && a.responseStatus === "declined"))
        .map(
          (e: any): TimelineItem => ({
            id: `cal:${slot}:${e.id}`,
            uid: e.iCalUID ? `${e.iCalUID}|${e.start?.dateTime ?? e.start?.date}` : undefined,
            title: e.summary ?? "(no title)",
            start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
            end: e.end?.dateTime ?? `${e.end?.date}T00:00:00`,
            allDay: !e.start?.dateTime,
            source: "calendar",
            location: e.location,
            account: label,
          }),
        );
    }),
  );
  return all.flat();
}

export async function getInbox(slot: Slot = PRIMARY, email?: string): Promise<InboxData> {
  const [label, list] = await Promise.all([
    gjson("https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX", {}, slot),
    gjson(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=4&q=${encodeURIComponent("is:unread in:inbox category:primary")}`,
      {},
      slot,
    ),
  ]);
  const who = email ?? "0";
  const messages = await Promise.all(
    (list.messages ?? []).map(async (m: any) => {
      const full = await gjson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        {},
        slot,
      );
      const h = (n: string) => full.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
      return {
        id: `${slot}:${m.id}`,
        from: h("From").replace(/<.*>/, "").replace(/"/g, "").trim() || h("From"),
        subject: h("Subject") || "(no subject)",
        url: `https://mail.google.com/mail/u/${encodeURIComponent(who)}/#inbox/${m.threadId ?? m.id}`,
        account: email,
      };
    }),
  );
  const unread = label.messagesUnread ?? messages.length;
  return { unread, messages, accounts: [{ email: email ?? "Gmail", unread }] };
}

/** Merge several inboxes: total unread, a couple of messages from each account. */
export function mergeInboxes(parts: InboxData[]): InboxData | null {
  if (!parts.length) return null;
  return {
    unread: parts.reduce((s, p) => s + p.unread, 0),
    accounts: parts.flatMap((p) => p.accounts),
    messages: parts.flatMap((p) => p.messages.slice(0, parts.length > 1 ? 3 : 5)),
  };
}

/** Same event showing up via two accounts (shared calendars) → keep one. */
export function dedupeEvents(events: TimelineItem[]): TimelineItem[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = e.uid ?? `${e.title.toLowerCase()}|${e.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
