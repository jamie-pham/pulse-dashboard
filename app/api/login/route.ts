import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { checkPassword, COOKIE, cookieOptions, makeToken } from "@/lib/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const pw = String(form.get("password") ?? "");
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.redirect(`${cfg.appUrl}/login?e=1`, 303);
  }
  const res = NextResponse.redirect(`${cfg.appUrl}/`, 303);
  res.cookies.set(COOKIE, makeToken(), cookieOptions);
  return res;
}
