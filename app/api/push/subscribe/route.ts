import { NextResponse } from "next/server";
import { addSub, removeSub } from "@/lib/push";
import { isAuthed } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  if (!/^https:\/\//.test(sub.endpoint)) return NextResponse.json({ error: "bad endpoint" }, { status: 400 });
  await addSub({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint === "string") await removeSub(endpoint);
  return NextResponse.json({ ok: true });
}
