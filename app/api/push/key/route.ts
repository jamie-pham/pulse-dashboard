import { NextResponse } from "next/server";
import { getVapid } from "@/lib/push";
import { isAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  return NextResponse.json({ publicKey: (await getVapid()).publicKey });
}
