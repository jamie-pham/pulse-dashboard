// Called every 5–15 minutes by an external scheduler (cron-job.org — free) with
//   Authorization: Bearer <BRIEF_TOKEN>
// Sends any due notifications: urgent ones immediately, digests at their slots. Each notification is sent once.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { cfg } from "@/lib/config";
import { buildDashboard } from "@/lib/dashboard";
import { digestNote, digestSlot, urgentNotes } from "@/lib/notify";
import { listSubs, markSent, sendAll, wasSent } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorised(req: Request): boolean {
  if (!cfg.briefToken) return false;
  const url = new URL(req.url);
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || url.searchParams.get("key") || "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  return got.length > 0 && timingSafeEqual(h(got), h(cfg.briefToken));
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!(await listSubs()).length) return NextResponse.json({ ok: true, skipped: "no devices subscribed" });

  const now = new Date();
  const d = await buildDashboard(false);
  const notes = urgentNotes(d, now);
  const slot = digestSlot(now);
  if (slot) {
    const dn = digestNote(d, slot, now);
    if (dn) notes.push(dn);
  }

  const sent: string[] = [];
  for (const n of notes) {
    if (await wasSent(n.id)) continue;
    await markSent(n.id); // mark first, so a slow push service can't cause a double send
    if (await sendAll(n)) sent.push(n.id);
  }
  return NextResponse.json({ ok: true, considered: notes.length, sent });
}
