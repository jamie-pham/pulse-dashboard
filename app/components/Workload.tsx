"use client";
// Glance first: one headline + a 14-day strip. Tap a day for its deadlines (detail behind a tap).

import { useState } from "react";
import type { Workload } from "@/lib/workload";

// Calendar dates ("2026-10-22") are formatted as UTC noon so they never shift a day; clock times use your time zone.
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
const dayName = (d: string) => new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "narrow" }).format(asDate(d));
const dayNum = (d: string) => Number(d.slice(8, 10));
const longDay = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(asDate(d));

export default function WorkloadCard({ w, tz }: { w: Workload; tz: string }) {
  const TZ = tz;
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(" ", "").replace(":00", "").toLowerCase();
  const ymdTz = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const relDay = (iso: string) => {
    const d = ymdTz(new Date(iso));
    if (d === w.days[0]?.date) return "Today";
    if (d === w.days[1]?.date) return "Tomorrow";
    return new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
  };
  // Open on the heaviest day this week if it's a big one, otherwise the next day with anything due.
  const peak = w.days.slice(0, 7).reduce((a, d) => (d.score > a.score ? d : a), w.days[0]);
  const initial = peak && peak.level >= 3 ? peak.date : (w.days.find((d) => d.count > 0)?.date ?? null);
  const [sel, setSel] = useState<string | null>(null);
  const day = w.days.find((d) => d.date === (sel ?? initial));

  return (
    <section className="card">
      <div className="card-head">
        <h3>Next 2 weeks</h3>
        {w.headline && <span className={`load-head lvl${w.headline.level}`}>{w.headline.text}</span>}
      </div>
      <div className="heat" role="list">
        {w.days.map((d, i) => (
          <button
            key={d.date}
            role="listitem"
            className={`heat-cell lvl${d.level} ${d.date === day?.date ? "sel" : ""} ${i === 7 ? "wk2" : ""}`}
            onClick={() => setSel(d.date)}
            aria-label={`${longDay(d.date)}: ${d.count} due`}
          >
            <span className="heat-d">{i === 0 ? "T" : dayName(d.date)}</span>
            <span className="heat-n">{dayNum(d.date)}</span>
            {d.count > 0 && <span className="heat-c">{d.count}</span>}
          </button>
        ))}
      </div>
      {day && day.count > 0 ? (
        <div className="heat-detail">
          <div className="subhead">
            {longDay(day.date)}
            {day.weight ? ` · ${day.weight}% of grades` : ""}
          </div>
          <ul className="list">
            {day.items.map((x) => (
              <li key={x.id}>
                <div className="li-main">
                  <div className="li-title">{x.title}</div>
                  <div className="muted small">{[x.course, time(x.due)].filter(Boolean).join(" · ")}</div>
                </div>
                {x.weight != null && <span className="due">{x.weight}%</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted small" style={{ marginTop: 10 }}>Nothing due that day.</p>
      )}
      {w.blocks.length > 0 && (
        <>
          <div className="subhead">Study windows</div>
          <ul className="list">
            {w.blocks.map((b) => (
              <li key={b.start}>
                <span className="dot" style={{ background: "var(--sleep)" }} />
                <div className="li-main">
                  <div className="li-title">{b.task.title}</div>
                  <div className="muted small">
                    {relDay(b.start)} {time(b.start)}–{time(b.end)}
                    {b.task.course ? ` · ${b.task.course}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
