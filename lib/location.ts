// Where you are, for weather and nearby emergencies.
// Defaults to HOME_LAT/HOME_LON; tapping 📍 in the app (or the iOS Shortcut passing ?lat=&lon=) overrides it.
// Stored rounded to ~1 km — precise enough for a forecast, not a tracker.

import { cfg } from "./config";
import { store } from "./store";

export interface Loc {
  lat: number;
  lon: number;
  label: string;
  phone: boolean;
}

const KEY = "location";
const round = (x: number) => Math.round(x * 100) / 100;

export async function getLocation(): Promise<Loc> {
  const saved = await store.get<{ lat: number; lon: number }>(KEY).catch(() => null);
  if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
    return { lat: saved.lat, lon: saved.lon, label: "Your location", phone: true };
  }
  return { lat: cfg.home.lat, lon: cfg.home.lon, label: cfg.home.label, phone: false };
}

export function validCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = Number(lat);
  const b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: round(a), lon: round(b) };
}

export async function setLocation(lat: number, lon: number) {
  await store.set(KEY, { lat: round(lat), lon: round(lon) });
}

export async function clearLocation() {
  await store.del(KEY);
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
