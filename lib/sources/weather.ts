// Weather from Open-Meteo — free, no API key, includes Australia's BOM model in its blend.

import { cfg } from "../config";
import { fetchJson } from "../errors";
import { localTime } from "../time";
import { weatherAdvice } from "../weather-advice";
import type { WeatherData, WeatherDay, WeatherHour } from "../types";

/** "2026-10-18T08:00" (local wall-clock, as Open-Meteo returns with timezone=...) → ISO instant. */
function parseLocal(s: string): string {
  const [d, t = "00:00"] = s.split("T");
  return localTime(d, t.slice(0, 5)).toISOString();
}

async function forecast(lat: number, lon: number) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("timezone", cfg.tz);
  u.searchParams.set("forecast_days", "3");
  u.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,relative_humidity_2m",
  );
  u.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,is_day");
  u.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset",
  );
  return fetchJson<any>(u.toString());
}

function hoursFrom(j: any): WeatherHour[] {
  const h = j.hourly ?? {};
  return (h.time ?? []).map((t: string, i: number) => ({
    time: parseLocal(t),
    temp: Math.round(h.temperature_2m?.[i] ?? NaN),
    feels: Math.round(h.apparent_temperature?.[i] ?? NaN),
    code: h.weather_code?.[i] ?? 0,
    pop: h.precipitation_probability?.[i] ?? 0,
    uv: Math.round((h.uv_index?.[i] ?? 0) * 10) / 10,
    isDay: Boolean(h.is_day?.[i] ?? 1),
  }));
}

function dayFrom(j: any, i: number): WeatherDay | null {
  const d = j.daily;
  if (!d?.time?.[i]) return null;
  return {
    date: d.time[i],
    code: d.weather_code[i],
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i]),
    pop: d.precipitation_probability_max?.[i] ?? 0,
    rainMm: Math.round((d.precipitation_sum?.[i] ?? 0) * 10) / 10,
    uvMax: Math.round((d.uv_index_max?.[i] ?? 0) * 10) / 10,
    sunrise: parseLocal(d.sunrise[i]),
    sunset: parseLocal(d.sunset[i]),
  };
}

export async function getWeather(lat: number, lon: number, place: string, campusAt?: string | null): Promise<WeatherData> {
  const [j, aq, campusJ] = await Promise.all([
    forecast(lat, lon),
    fetchJson<any>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=${encodeURIComponent(cfg.tz)}`,
    ).catch(() => null),
    campusAt ? forecast(cfg.campus.lat, cfg.campus.lon).catch(() => null) : Promise.resolve(null),
  ]);

  const nowMs = Date.now();
  const all = hoursFrom(j);
  const startIdx = Math.max(0, all.findIndex((h) => Date.parse(h.time) + 3600e3 > nowMs));
  const hours = all.slice(startIdx, startIdx + 16);
  const today = dayFrom(j, 0)!;
  const tomorrow = dayFrom(j, 1);
  const c = j.current ?? {};
  const now = {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    code: c.weather_code ?? 0,
    isDay: Boolean(c.is_day ?? 1),
    wind: Math.round(c.wind_speed_10m ?? 0),
    gust: Math.round(c.wind_gusts_10m ?? 0),
    humidity: Math.round(c.relative_humidity_2m ?? 0),
  };
  const aqi = Number.isFinite(aq?.current?.us_aqi) ? Math.round(aq.current.us_aqi) : null;

  let campus: WeatherData["campus"] = null;
  if (campusJ && campusAt) {
    const ch = hoursFrom(campusJ);
    const target = Date.parse(campusAt);
    const best = ch.reduce((a, b) => (Math.abs(Date.parse(b.time) - target) < Math.abs(Date.parse(a.time) - target) ? b : a), ch[0]);
    if (best) campus = { label: cfg.campus.label, at: campusAt, temp: best.temp, code: best.code, pop: best.pop };
  }

  return {
    place,
    now,
    hours,
    today,
    tomorrow,
    aqi,
    campus,
    advice: weatherAdvice({ now, hours: hours.slice(0, 14), today, aqi }),
  };
}
