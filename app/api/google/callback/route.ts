import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { exchangeCode } from "@/lib/google";
import { isAuthed } from "@/lib/session";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(`${cfg.appUrl}/?${q}`);
    res.cookies.delete("pulse_oauth_state");
    return res;
  };

  if (!(await isAuthed())) return NextResponse.redirect(`${cfg.appUrl}/login`);
  const expected = (await cookies()).get("pulse_oauth_state")?.value;
  if (!expected || url.searchParams.get("state") !== expected) return back(`error=${encodeURIComponent("Sign-in state mismatch — try again")}`);
  if (url.searchParams.get("error")) return back(`error=${encodeURIComponent(`Google said: ${url.searchParams.get("error")}`)}`);

  try {
    await exchangeCode(url.searchParams.get("code") ?? "");
    await store.del("cache:health").catch(() => {});
    await store.del("cache:inbox").catch(() => {});
    return back("connected=1");
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't connect Google")}`);
  }
}
