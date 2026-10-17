// Google Calendar + Gmail, using the same Google sign-in as the health data.

import { cfg } from "../config";
import { gjson } from "../google";
import type { InboxData, TimelineItem } from "../types";

export async function getCalendar(from: Date, to: Date): Promise<TimelineItem[]> {
  const all = await Promise.all(
    cfg.google.calendarIds.map(async (calId) => {
      const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
      u.searchParams.set("timeMin", from.toISOString());
      u.searchParams.set("timeMax", to.toISOString());
      u.searchParams.set("singleEvents", "true");
      u.searchParams.set("orderBy", "startTime");
      u.searchParams.set("maxResults", "50");
      const j = await gjson(u.toString());
      return (j.items ?? [])
        .filter((e: any) => e.status !== "cancelled" && e.eventType !== "workingLocation")
        .filter((e: any) => !(e.attendees ?? []).some((a: any) => a.self && a.responseStatus === "declined"))
        .map(
          (e: any): TimelineItem => ({
            id: `cal:${e.id}`,
            title: e.summary ?? "(no title)",
            start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
            end: e.end?.dateTime ?? `${e.end?.date}T00:00:00`,
            allDay: !e.start?.dateTime,
            source: "calendar",
            location: e.location,
          }),
        );
    }),
  );
  return all.flat();
}

export async function getInbox(): Promise<InboxData> {
  const label = await gjson("https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX");
  const list = await gjson(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent("is:unread in:inbox category:primary")}`,
  );
  const messages = await Promise.all(
    (list.messages ?? []).map(async (m: any) => {
      const full = await gjson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      );
      const h = (n: string) => full.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
      return {
        id: m.id,
        from: h("From").replace(/<.*>/, "").replace(/"/g, "").trim() || h("From"),
        subject: h("Subject") || "(no subject)",
        url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId ?? m.id}`,
      };
    }),
  );
  return { unread: label.messagesUnread ?? messages.length, messages };
}
