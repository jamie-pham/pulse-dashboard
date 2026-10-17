import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cfg, isProd } from "@/lib/config";
import { authUrl, googleConfigured } from "@/lib/google";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.redirect(`${cfg.appUrl}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${cfg.appUrl}/?error=${encodeURIComponent("Google client ID/secret not set")}`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("pulse_oauth_state", state, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
