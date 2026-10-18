"use client";
import { useState } from "react";

export default function Routine({ items, done: initial }: { items: string[]; done: string[] }) {
  const [done, setDone] = useState<string[]>(initial);

  async function toggle(item: string) {
    const next = !done.includes(item);
    setDone((d) => (next ? [...d, item] : d.filter((x) => x !== item)));
    const res = await fetch("/api/routine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, done: next }),
    }).catch(() => null);
    if (res?.ok) setDone((await res.json()).done);
  }

  const pct = items.length ? done.length / items.length : 0;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Morning routine</h3>
        <span className="muted small">{done.length === items.length ? "all done ✓" : `${done.length}/${items.length}`}</span>
      </div>
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
