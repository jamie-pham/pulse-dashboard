// The brief as JSON or plain text. Used by the iOS Shortcut that runs when your alarm stops:
//   GET /api/brief?format=text   Authorization: Bearer <BRIEF_TOKEN>
// Optional ?lat=&lon= (Shortcuts "Get Current Location") updates where weather is checked.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { buildDashboard } from "@/lib/dashboard";
import { setLocation, validCoords } from "@/lib/location";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function tokenOk(req: Request): boolean {
  if (!cfg.briefToken) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const h = (s: string) => createHash("sha256").update(s).digest();
  return got.length > 0 && timingSafeEqual(h(got), h(cfg.briefToken));
}

export async function GET(req: Request) {
  if (!tokenOk(req) && !(await isAuthed())) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const coords = validCoords(url.searchParams.get("lat"), url.searchParams.get("lon"));
  if (coords && !cfg.demo) await setLocation(coords.lat, coords.lon);

  const fresh = url.searchParams.get("fresh") === "1";
  const d = await buildDashboard(fresh, url.searchParams.get("at") ?? undefined);

  if (url.searchParams.get("format") === "text") {
    return new NextResponse(d.brief.spoken, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { phase: d.brief.phase, title: d.brief.title, lines: d.brief.lines, spoken: d.brief.spoken, generatedAt: d.generatedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
