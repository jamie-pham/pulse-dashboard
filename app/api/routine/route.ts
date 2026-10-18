import { NextResponse } from "next/server";
import { setRoutineItem } from "@/lib/extras";
import { isAuthed } from "@/lib/session";
import { ymd } from "@/lib/time";

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { item, done } = await req.json().catch(() => ({}));
  if (typeof item !== "string") return NextResponse.json({ error: "item required" }, { status: 400 });
  return NextResponse.json(await setRoutineItem(ymd(), item, Boolean(done)));
}
