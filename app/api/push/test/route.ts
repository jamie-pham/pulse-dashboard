import { NextResponse } from "next/server";
import { sendAll } from "@/lib/push";
import { isAuthed } from "@/lib/session";

export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const sent = await sendAll({
    id: `test:${Date.now()}`,
    title: "Pulse notifications are on ✓",
    body: "You'll get leave-by, deadline and emergency alerts right away — everything else in 3 short digests a day.",
    urgent: true,
  });
  return NextResponse.json({ sent });
}
