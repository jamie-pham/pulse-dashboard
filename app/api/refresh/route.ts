import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Bypasses the 5-minute cache and re-pulls every source. */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const d = await buildDashboard(true);
  return NextResponse.json({ ok: true, generatedAt: d.generatedAt });
}
