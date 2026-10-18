import { NextResponse } from "next/server";
import { clearLocation, setLocation, validCoords } from "@/lib/location";
import { isAuthed } from "@/lib/session";

/** POST {lat, lon} to use your phone's location for weather/alerts; DELETE to go back to HOME_LAT/HOME_LON. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const c = validCoords(body.lat, body.lon);
  if (!c) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });
  await setLocation(c.lat, c.lon);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  await clearLocation();
  return NextResponse.json({ ok: true });
}
