import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.redirect(`${cfg.appUrl}/login`, 303);
  res.cookies.delete(COOKIE);
  return res;
}
