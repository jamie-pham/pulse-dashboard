// Emergencies near you from VicEmergency's public feed (the same data the VicEmergency app uses).

import { cfg } from "../config";
import { fetchJson, SourceError } from "../errors";
import { haversineKm } from "../location";
import type { EmergencyAlert } from "../types";

const FEED = "https://emergency.vic.gov.au/public/osom-geojson.json";
const QUIET_STATUS = /^(safe|under control|complete|completed|patrolled|unknown|minor|contained)$/i;

function coordsOf(g: any): [number, number][] {
  if (!g) return [];
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "GeometryCollection") return (g.geometries ?? []).flatMap(coordsOf);
  const flat: [number, number][] = [];
  const walk = (x: any) => {
    if (Array.isArray(x) && typeof x[0] === "number") flat.push([x[0], x[1]]);
    else if (Array.isArray(x)) x.forEach(walk);
  };
  walk(g.coordinates);
  return flat;
}

/** Closest point of the feature (polygon vertex or point) to you, in km. */
export function distanceTo(g: any, lat: number, lon: number): number {
  const pts = coordsOf(g);
  if (!pts.length) return Infinity;
  return Math.min(...pts.map(([x, y]) => haversineKm(lat, lon, y, x)));
}

export function pickAlerts(features: any[], lat: number, lon: number, radiusKm: number): EmergencyAlert[] {
  const out: EmergencyAlert[] = [];
  for (const f of features) {
    const p = f?.properties ?? {};
    const type = String(p.feedType ?? "");
    const isWarning = type === "warning";
    if (!isWarning && type !== "incident") continue;
    if (/burn/i.test(`${p.category1} ${p.category2}`)) continue;
    if (!isWarning && QUIET_STATUS.test(String(p.status ?? ""))) continue;

    const km = distanceTo(f.geometry, lat, lon);
    if (km > (isWarning ? Math.max(radiusKm * 3, 30) : radiusKm)) continue;

    out.push({
      id: String(p.id ?? p.sourceId ?? `${p.category2}-${p.location}`),
      kind: isWarning ? "warning" : "incident",
      title: isWarning ? String(p.name ?? p.category2 ?? "Warning") : String(p.category2 ?? p.category1 ?? "Incident"),
      detail: String(p.location ?? p.sourceTitle ?? ""),
      status: String(p.status ?? p.action ?? ""),
      distanceKm: Math.round(km * 10) / 10,
      updated: String(p.updated ?? p.created ?? ""),
      url: isWarning && p.sourceId ? `https://emergency.vic.gov.au/respond/#!/warning/${p.sourceId}/moreinfo` : "https://emergency.vic.gov.au/respond/",
    });
  }
  return out
    .sort((a, b) => (a.kind === b.kind ? a.distanceKm - b.distanceKm : a.kind === "warning" ? -1 : 1))
    .slice(0, 4);
}

export async function getAlerts(lat: number, lon: number): Promise<EmergencyAlert[]> {
  if (!cfg.alerts.enabled) throw new SourceError("off", "ALERTS=off");
  const j = await fetchJson<any>(FEED);
  return pickAlerts(j?.features ?? [], lat, lon, cfg.alerts.radiusKm);
}
