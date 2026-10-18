// Weather codes → words/emoji, and the "what should I take today" rules. Pure functions (tested).

import { fmtTime as fmtFull } from "./time";
import type { Advice, WeatherDay, WeatherHour } from "./types";

const fmtTime = (iso: string) => fmtFull(iso).replace(":00", "");

const WMO: Record<number, [string, string, string?]> = {
  0: ["Clear", "☀️", "🌙"],
  1: ["Mostly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️"],
  81: ["Showers", "🌧️"],
  82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "🌨️"],
  95: ["Thunderstorms", "⛈️"],
  96: ["Storms with hail", "⛈️"],
  99: ["Storms with hail", "⛈️"],
};

export function wmo(code: number, isDay = true): { label: string; icon: string } {
  const [label, day, night] = WMO[code] ?? ["—", "🌡️"];
  return { label, icon: !isDay && night ? night : day };
}

export const isWet = (code: number) => code >= 51 && code <= 99 && !(code >= 71 && code <= 77);

export function weatherAdvice(w: {
  now: { temp: number; feels: number; code: number; gust: number };
  hours: WeatherHour[];
  today: WeatherDay;
  aqi: number | null;
}): Advice[] {
  const out: Advice[] = [];
  const hours = w.hours.length ? w.hours : [];
  const feelsMin = Math.min(w.now.feels, ...hours.map((h) => h.feels).filter(Number.isFinite));
  const max = Math.max(w.today.max, ...hours.map((h) => h.temp).filter(Number.isFinite));

  // Rain
  if (isWet(w.now.code)) {
    out.push({ icon: "☂️", text: `${wmo(w.now.code).label} now — take an umbrella` });
  } else {
    const firstWet = hours.find((h) => h.pop >= 50);
    const maybe = hours.reduce<WeatherHour | null>((a, h) => (h.pop >= 30 && (!a || h.pop > a.pop) ? h : a), null);
    if (firstWet)
      out.push({
        icon: "☂️",
        text: `Umbrella — ${firstWet.pop}% chance of rain around ${fmtTime(firstWet.time)}`,
        say: `There's a ${firstWet.pop}% chance of rain around ${fmtTime(firstWet.time)}, so take an umbrella`,
      });
    else if (maybe) out.push({ icon: "🌦️", text: `Possible showers (${maybe.pop}%) around ${fmtTime(maybe.time)}` });
  }
  const storm = hours.find((h) => h.code >= 95);
  if (storm) out.push({ icon: "⛈️", text: `Thunderstorms possible around ${fmtTime(storm.time)}` });

  // Temperature
  if (feelsMin <= 10) {
    out.push({
      icon: "🧥",
      text: `Jacket — feels like ${feelsMin}°${max - feelsMin >= 8 ? `, up to ${max}° later` : ""}`,
      say: `It feels like ${feelsMin}°, so grab a jacket`,
    });
  } else if (max - feelsMin >= 10) {
    out.push({ icon: "👕", text: `Layers — ${feelsMin}° to ${max}° today` });
  }
  if (max >= 35) out.push({ icon: "🥵", text: `Very hot — ${max}°. Water bottle, avoid midday sun` });
  else if (max >= 30) out.push({ icon: "💧", text: `Hot — ${max}°. Bring water` });

  // UV — Cancer Council: sun protection from UV 3
  const sunny = hours.filter((h) => h.isDay);
  const peak = sunny.reduce<WeatherHour | null>((a, h) => (!a || h.uv > a.uv ? h : a), null);
  const uv = Math.max(peak?.uv ?? 0, hours.length < 8 ? w.today.uvMax : 0);
  if (uv >= 3) {
    const when = peak && peak.uv >= 3 ? ` around ${fmtTime(peak.time)}` : "";
    out.push({
      icon: "🧴",
      text: `Sunscreen — UV ${Math.round(uv)}${uv >= 8 ? " (very high)" : uv >= 6 ? " (high)" : ""}${when}`,
      say: `UV gets to ${Math.round(uv)}${when}, so wear sunscreen if you're outside`,
    });
  }

  if (w.now.gust >= 50) out.push({ icon: "💨", text: `Gusty — up to ${w.now.gust} km/h` });
  if (w.aqi != null && w.aqi > 100) out.push({ icon: "😷", text: `Poor air quality (AQI ${w.aqi})` });
  return out;
}
