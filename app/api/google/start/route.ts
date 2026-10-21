import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cfg, isProd } from "@/lib/config";
import { authUrl, googleConfigured, type Mode } from "@/lib/google";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

/** /api/google/start — connect the primary (Fitbit) account. /api/google/start?mode=add — add another account for calendar + Gmail. */
export async function GET(req: Request) {
  if (!(await isAuthed())) return NextResponse.redirect(`${cfg.appUrl}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${cfg.appUrl}/?error=${encodeURIComponent("Google client ID/secret not set")}`);
  const mode: Mode = new URL(req.url).searchParams.get("mode") === "add" ? "add" : "primary";
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state, mode));
  res.cookies.set("pulse_oauth_state", `${state}.${mode}`, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
