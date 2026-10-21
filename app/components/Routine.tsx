"use client";
import { useState } from "react";
import type { Streak } from "@/lib/extras";

/** Forgiving streak copy: never "streak lost", just a fresh start; one free pass a week. */
function streakLabel(s: Streak, doneToday: boolean): string | null {
  if (s.days >= 2) return `🔥 ${s.days}-day streak${s.passUsed ? " · free pass used this week" : " · 1 free pass this week"}`;
  if (s.days === 1) return doneToday ? "🔥 Day 1 — nice" : "🔥 1 day — keep it going";
  if (s.freshStart) return "🌱 Fresh start today";
  return null;
}

export default function Routine({ items, done: initial, streak }: { items: string[]; done: string[]; streak?: Streak }) {
  const [done, setDone] = useState<string[]>(initial);
  const [st, setSt] = useState<Streak | undefined>(streak);

  async function toggle(item: string) {
    const next = !done.includes(item);
    setDone((d) => (next ? [...d, item] : d.filter((x) => x !== item)));
    const res = await fetch("/api/routine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, done: next }),
    }).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setDone(j.done);
      if (j.streak) setSt(j.streak);
    }
  }

  const pct = items.length ? done.length / items.length : 0;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Morning routine</h3>
        <span className="muted small">{done.length === items.length ? "all done ✓" : `${done.length}/${items.length}`}</span>
      </div>
      {st && streakLabel(st, done.length >= Math.ceil(items.length / 2)) && (
        <div className="streak small">{streakLabel(st, done.length >= Math.ceil(items.length / 2))}</div>
      )}
      <div className="progress"><div style={{ width: `${pct * 100}%` }} /></div>
      <ul className="checks">
        {items.map((it) => {
          const on = done.includes(it);
          return (
            <li key={it}>
              <button className={`check ${on ? "on" : ""}`} onClick={() => toggle(it)} aria-pressed={on}>
                <span className="box">{on ? "✓" : ""}</span>
                <span>{it}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
