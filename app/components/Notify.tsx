"use client";
// Turn on push notifications. On iPhone this only works from the Home Screen app (iOS 16.4+),
// and the permission prompt must come from a tap — so it's a button, never automatic.

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied" | "busy";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function NotifyButton() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(isIOS && !standalone ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setState("busy");
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
      await fetch("/api/push/test", { method: "POST" });
      setMsg("Sent a test notification.");
    } catch {
      setState("off");
      setMsg("Couldn't turn notifications on — try again from the Home Screen app.");
    }
  }

  async function disable() {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setMsg("");
  }

  async function test() {
    const r = await (await fetch("/api/push/test", { method: "POST" })).json().catch(() => ({ sent: 0 }));
    setMsg(r.sent ? "Test sent." : "No device received it — try turning notifications off and on.");
  }

  return (
    <div className="notify">
      {state === "on" ? (
        <>
          <span className="small">🔔 Notifications on</span>
          <button className="link small" onClick={test}>send test</button>
          <button className="link small" onClick={disable}>turn off</button>
        </>
      ) : state === "off" || state === "busy" ? (
        <button className="pill-btn" onClick={enable} disabled={state === "busy"}>
          {state === "busy" ? "Turning on…" : "🔔 Turn on notifications"}
        </button>
      ) : state === "needs-install" ? (
        <span className="muted small">🔔 To get notifications, open Pulse from your Home Screen icon (Share → Add to Home Screen).</span>
      ) : state === "denied" ? (
        <span className="muted small">🔕 Notifications are blocked — allow them in iPhone Settings → Notifications → Pulse.</span>
      ) : state === "unsupported" ? (
        <span className="muted small">🔕 This browser can't do notifications.</span>
      ) : null}
      {msg && <span className="muted small">{msg}</span>}
    </div>
  );
}
