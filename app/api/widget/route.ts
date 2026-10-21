// Lock screen feed for the iOS app's widgets.
//   GET /api/widget   Authorization: Bearer <BRIEF_TOKEN>
// Returns lib/widget.ts WidgetFeed. Uses the normal per-source cache, so frequent widget refreshes are cheap.

import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { isAuthed } from "@/lib/session";
import { tokenOk } from "@/lib/token";
import { buildWidget } from "@/lib/widget";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!tokenOk(req) && !(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const url = new URL(req.url);
  const d = await buildDashboard(false, url.searchParams.get("at") ?? undefined);
  return NextResponse.json(buildWidget(d, new Date(d.generatedAt)), { headers: { "Cache-Control": "no-store" } });
}
