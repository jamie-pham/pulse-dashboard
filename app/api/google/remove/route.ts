import { NextResponse } from "next/server";
import { removeAccount } from "@/lib/google";
import { isAuthed } from "@/lib/session";
import { clearCache } from "@/lib/store";

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) return NextResponse.json({ error: "email required" }, { status: 400 });
  await removeAccount(email);
  await clearCache();
  return NextResponse.json({ ok: true });
}
