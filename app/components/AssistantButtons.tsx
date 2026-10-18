"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Reads the brief aloud with the phone's own voice (Web Speech API — works in iOS Safari and home-screen apps). */
export function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    u.voice =
      voices.find((v) => v.lang === "en-AU" && /premium|enhanced|siri/i.test(v.name)) ??
      voices.find((v) => v.lang === "en-AU") ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null;
    u.rate = 1.02;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }

  return (
    <button className="speak" onClick={toggle} aria-label={speaking ? "Stop reading" : "Read brief aloud"}>
      {speaking ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
      )}
      {speaking ? "Stop" : "Read it to me"}
    </button>
  );
}

/** Switch weather + emergency checks between your phone's location and HOME_LAT/HOME_LON. */
export function LocationButton({ usingPhone, place }: { usingPhone: boolean; place: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied">("idle");

  async function useHere() {
    if (!navigator.geolocation) return setState("denied");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        });
        setState("idle");
        router.refresh();
      },
      () => setState("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60e3 },
    );
  }

  async function useHome() {
    setState("busy");
    await fetch("/api/location", { method: "DELETE" });
    setState("idle");
    router.refresh();
  }

  return (
    <span className="loc">
      📍 {place}
      {state === "busy" ? (
        <span className="muted"> · locating…</span>
      ) : state === "denied" ? (
        <span className="muted"> · location blocked</span>
      ) : usingPhone ? (
        <>
          {" · "}
          <button className="link" onClick={useHere}>update</button>
          {" · "}
          <button className="link" onClick={useHome}>use home</button>
        </>
      ) : (
        <>
          {" · "}
          <button className="link" onClick={useHere}>use my location</button>
        </>
      )}
    </span>
  );
}
