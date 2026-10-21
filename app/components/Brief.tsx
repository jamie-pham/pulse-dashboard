import { fmtDay, fmtTime } from "@/lib/time";
import { wmo } from "@/lib/weather-advice";
import type { Brief, Countdown, EmergencyAlert, WeatherData } from "@/lib/types";
import { LocationButton, SpeakButton } from "./AssistantButtons";

// Show three lines, ranked by how actionable they are; the rest sit behind "N more" (the spoken brief still
// reads everything). Kinds already shown elsewhere on screen — the next event in the Now card, alerts in their
// own card — aren't repeated.
const RANK = ["sleep", "due", "advice", "study", "load", "body", "countdown", "info", "inbox", "weather", "event", "alert"];
export function briefSections(brief: Brief, hasWeather: boolean, hide: string[] = []) {
  const lines = brief.lines
    .filter((l) => !(l.spokenOnly && hasWeather))
    .filter((l) => !hide.includes(l.kind ?? "info"))
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (RANK.indexOf(a.l.kind ?? "info") + 1 || 99) - (RANK.indexOf(b.l.kind ?? "info") + 1 || 99) || a.i - b.i)
    .map((x) => x.l);
  return { top: lines.slice(0, 3), rest: lines.slice(3) };
}

const hourLabel = (iso: string) => fmtTime(iso).replace(":00", "");

export function BriefCard({
  brief,
  weather,
  usingPhone,
  now: nowIso,
  hideKinds = [],
}: {
  hideKinds?: string[];
  brief: Brief;
  weather: WeatherData | null;
  usingPhone: boolean;
  now: string;
}) {
  const now = weather ? wmo(weather.now.code, weather.now.isDay) : null;
  const { top, rest } = briefSections(brief, !!weather, hideKinds);
  const sunsetSoon = weather && Date.parse(weather.today.sunset) > Date.parse(nowIso);
  return (
    <section className={`card brief phase-${brief.phase}`}>
      {weather && now && (
        <>
          <div className="wx">
            <div className="wx-icon" aria-hidden>{now.icon}</div>
            <div className="wx-main">
              <div className="wx-temp">{weather.now.temp}°</div>
              <div className="wx-cond">
                {now.label} · feels {weather.now.feels}°
              </div>
            </div>
            <div className="wx-side">
              <div>
                <span className="muted">H</span> {weather.today.max}° <span className="muted">L</span> {weather.today.min}°
              </div>
              <div className="muted small">
                {sunsetSoon ? `sunset ${fmtTime(weather.today.sunset)}` : weather.tomorrow ? `sunrise ${fmtTime(weather.tomorrow.sunrise)}` : ""}
              </div>
              <div className="muted small">
                wind {weather.now.wind} km/h{weather.aqi != null ? ` · AQI ${weather.aqi}` : ""}
              </div>
            </div>
          </div>
          <div className="hourly" role="list">
            {weather.hours.slice(0, 14).map((h, i) => {
              const w = wmo(h.code, h.isDay);
              return (
                <div key={h.time} className="hour" role="listitem">
                  <div className="hour-t">{i === 0 ? "Now" : hourLabel(h.time)}</div>
                  <div className="hour-i" title={w.label}>{w.icon}</div>
                  <div className="hour-temp">{h.temp}°</div>
                  <div className="hour-pop">{h.pop >= 20 ? `${h.pop}%` : " "}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="brief-head">
        <h3>{brief.title}</h3>
        <SpeakButton text={brief.spoken} />
      </div>
      <ul className="brief-lines">
        {top.map((l, i) => (
          <li key={i}>
            <span className="bl-icon" aria-hidden>{l.icon}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="brief-more">
          <summary>{rest.length} more</summary>
          <ul className="brief-lines">
            {rest.map((l, i) => (
              <li key={i}>
                <span className="bl-icon" aria-hidden>{l.icon}</span>
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {weather && (
        <div className="brief-foot muted small">
          <LocationButton usingPhone={usingPhone} place={weather.place} />
        </div>
      )}
    </section>
  );
}

export function AlertsCard({ alerts }: { alerts: EmergencyAlert[] }) {
  if (!alerts.length) return null;
  return (
    <section className="card alerts">
      <div className="card-head">
        <h3>⚠️ Near you</h3>
        <a className="small" href="https://emergency.vic.gov.au/respond/" target="_blank" rel="noreferrer">VicEmergency →</a>
      </div>
      <ul className="list">
        {alerts.map((a) => (
          <li key={a.id}>
            <a href={a.url} target="_blank" rel="noreferrer">
              <span className="dot" style={{ background: a.kind === "warning" ? "var(--red)" : "var(--orange)" }} />
              <div className="li-main">
                <div className="li-title">{a.title}</div>
                <div className="muted small">{[a.detail, a.status].filter(Boolean).join(" · ")}</div>
              </div>
              <span className="due">{a.distanceKm} km</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CountdownCard({ countdowns }: { countdowns: Countdown[] }) {
  if (!countdowns.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Countdown</h3>
      </div>
      <div className="countdowns">
        {countdowns.slice(0, 4).map((c) => (
          <div key={c.label} className="cd">
            <div className="cd-n">{c.days}</div>
            <div className="cd-u muted small">{c.days === 1 ? "day" : "days"}</div>
            <div className="cd-l">{c.label}</div>
            <div className="muted small">{fmtDay(`${c.date}T12:00:00`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
