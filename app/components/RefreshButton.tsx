"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function RefreshButton({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [ago, setAgo] = useState("");

  useEffect(() => {
    const tick = () => {
      const m = Math.round((Date.now() - Date.parse(generatedAt)) / 60000);
      setAgo(m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [generatedAt]);

  // Coming back to the app after a while? Refresh automatically.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - Date.parse(generatedAt) > 5 * 60000) {
        start(() => router.refresh());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [generatedAt, router]);

  async function refresh() {
    setBusy(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } finally {
      setBusy(false);
      start(() => router.refresh());
    }
  }

  const spinning = busy || pending;
  return (
    <button className="refresh" onClick={refresh} disabled={spinning} aria-label="Refresh">
      <span className="refresh-ago">{spinning ? "syncing…" : ago}</span>
      <svg className={spinning ? "spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
