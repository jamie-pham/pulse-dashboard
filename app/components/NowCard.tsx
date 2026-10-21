"use client";
// The 5-second glance: the one thing to know right now, with a live countdown. Mirrors the lock screen widget
// (same feed, same priorities), so the phone and the app always agree.
//   emergency warning → time to leave → what's on now → what's next → free time

import { useEffect, useState } from "react";
import type { WidgetFeed } from "@/lib/widget";

const LEAVE_WINDOW = 90 * 60e3;

/** Starts at the server's time (no hydration mismatch, and ?at= previews still work), then ticks in real time. */
function useNow(startIso: string, tickMs = 15000) {
  const start = Date.parse(startIso);
  const [now, setNow] = useState(start);
  useEffect(() => {
    const mounted = Date.now();
    const id = setInterval(() => setNow(start + (Date.now() - mounted)), tickMs);
    return () => clearInterval(id);
  }, [start, tickMs]);
  return now;
}

export default function NowCard({ feed, tz }: { feed: WidgetFeed; tz: string }) {
  const now = useNow(feed.generatedAt);
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" })
      .format(new Date(iso))
      .replace(" ", "")
      .replace(":00", "")
      .toLowerCase();
  const ymd = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(ms);
  const dayWord = (iso: string) => {
    const d = ymd(Date.parse(iso));
    if (d === ymd(now)) return "";
    if (d === ymd(now + 86400e3)) return "Tomorrow ";
    return new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short" }).format(new Date(iso)) + " ";
  };
  const left = (ms: number) => {
    const m = Math.max(0, Math.ceil(ms / 60e3));
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`;
  };

  const events = feed.events.filter((e) => Date.parse(e.end) > now);
  const live = events.find((e) => Date.parse(e.start) <= now);
  const next = events.find((e) => Date.parse(e.start) > now);
  const leave = events.find((e) => e.leaveAt && Date.parse(e.start) > now);
  const leaveSoon = leave && now >= Date.parse(leave.leaveAt!) - LEAVE_WINDOW ? leave : null;
  const study = feed.study && Date.parse(feed.study.end) > now ? feed.study : null;

  let tone = "calm";
  let kicker = "";
  let big = "";
  let sub = "";

  if (feed.alert) {
    tone = "alert";
    kicker = "⚠️ Emergency warning";
    big = feed.alert.title;
    sub = `${feed.alert.detail} · ${feed.alert.distanceKm} km away`;
  } else if (leaveSoon) {
    const ms = Date.parse(leaveSoon.leaveAt!) - now;
    tone = ms <= 15 * 60e3 ? "urgent" : "go";
    kicker = "🚗 Leave";
    big = ms > 0 ? `in ${left(ms)}` : "now";
    sub = `${leaveSoon.title} at ${time(leaveSoon.start)}${leaveSoon.where ? ` · ${leaveSoon.where}` : ""}`;
  } else if (live) {
    kicker = "Now";
    big = live.title;
    sub = `until ${time(live.end)}${next && ymd(Date.parse(next.start)) === ymd(now) ? ` · then ${next.title} ${time(next.start)}` : ""}`;
  } else if (next) {
    kicker = `${dayWord(next.start)}Next · ${time(next.start)}`;
    big = next.title;
    sub = next.leaveAt
      ? `leave by ${time(next.leaveAt)} · in ${left(Date.parse(next.leaveAt) - now)}`
      : next.where ?? `in ${left(Date.parse(next.start) - now)}`;
  } else {
    kicker = "Free";
    big = study ? `Study ${study.title}` : "Nothing scheduled";
    sub = study ? `${time(study.start)}–${time(study.end)} is clear` : "Nothing else on today";
  }

  const w = feed.weather;
  const rainSoon = w?.rainAt && Date.parse(w.rainAt) > now - 3600e3 && ymd(Date.parse(w.rainAt)) === ymd(now);
  const due = feed.due.find((d) => Date.parse(d.due) > now);
  const chips: { key: string; text: string; warn?: boolean }[] = [];
  if (w) chips.push({ key: "wx", text: `${w.icon} ${w.temp}°${rainSoon ? ` · ☂️ ${time(w.rainAt!)}` : ` · ${w.hi}° high`}`, warn: !!rainSoon });
  if (study && (live || leaveSoon || next)) chips.push({ key: "study", text: `📚 ${time(study.start)} ${study.title}` });
  if (due) chips.push({ key: "due", text: `📌 ${due.title}${due.weight ? ` ${due.weight}%` : ""} · ${dayWord(due.due).trim() || time(due.due)}` });

  return (
    <section className={`card now now-${tone}`} aria-live="polite">
      <div className="now-kicker">{kicker}</div>
      <div className="now-big">{big}</div>
      {sub && <div className="now-sub">{sub}</div>}
      {chips.length > 0 && (
        <div className="now-chips">
          {chips.map((c) => (
            <span key={c.key} className={`chip${c.warn ? " warn" : ""}`}>
              {c.text}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
