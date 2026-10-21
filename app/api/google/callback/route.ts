import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { exchangeCode, type Mode } from "@/lib/google";
import { isAuthed } from "@/lib/session";
import { clearCache } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(`${cfg.appUrl}/?${q}`);
    res.cookies.delete("pulse_oauth_state");
    return res;
  };

  if (!(await isAuthed())) return NextResponse.redirect(`${cfg.appUrl}/login`);
  const [expected, modeRaw] = ((await cookies()).get("pulse_oauth_state")?.value ?? "").split(".");
  const mode: Mode = modeRaw === "add" ? "add" : "primary";
  if (!expected || url.searchParams.get("state") !== expected) return back(`error=${encodeURIComponent("Sign-in state mismatch — try again")}`);
  if (url.searchParams.get("error")) {
    const err = url.searchParams.get("error");
    const hint = err === "access_denied" && mode === "add" ? " — add this account as a test user in Google Cloud first" : "";
    return back(`error=${encodeURIComponent(`Google said: ${err}${hint}`)}`);
  }

  try {
    const { email, slot } = await exchangeCode(url.searchParams.get("code") ?? "", mode);
    await clearCache();
    return back(mode === "add" && slot !== "primary" ? `added=${encodeURIComponent(email ?? "")}` : "connected=1");
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't connect Google")}`);
  }
}
