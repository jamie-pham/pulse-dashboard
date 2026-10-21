// Web Push for the home-screen app (iOS 16.4+). Keys are generated on first use and kept in the store,
// so there's nothing extra to configure.

import webpush from "web-push";
import { cfg } from "./config";
import { store } from "./store";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  addedAt?: string;
}

export interface PushNote {
  id: string;
  title: string;
  body: string;
  url?: string;
  urgent?: boolean;
}

const VAPID = "push:vapid";
const SUBS = "push:subs";

export async function getVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await store.get<{ publicKey: string; privateKey: string }>(VAPID);
  if (existing?.publicKey && existing.privateKey) return existing;
  const keys = webpush.generateVAPIDKeys();
  await store.set(VAPID, keys);
  return keys;
}

export async function listSubs(): Promise<PushSub[]> {
  return (await store.get<PushSub[]>(SUBS).catch(() => null)) ?? [];
}

export async function addSub(sub: PushSub) {
  const subs = (await listSubs()).filter((s) => s.endpoint !== sub.endpoint);
  subs.push({ endpoint: sub.endpoint, keys: sub.keys, addedAt: new Date().toISOString() });
  await store.set(SUBS, subs.slice(-5)); // a few devices at most
}

export async function removeSub(endpoint: string) {
  await store.set(SUBS, (await listSubs()).filter((s) => s.endpoint !== endpoint));
}

export async function wasSent(id: string): Promise<boolean> {
  return Boolean(await store.get(`push:sent:${id}`).catch(() => null));
}

export async function markSent(id: string, ttlSec = 60 * 60 * 48) {
  await store.set(`push:sent:${id}`, 1, ttlSec);
}

/** Send to every subscribed device; drops subscriptions the push service says are gone. */
export async function sendAll(note: PushNote): Promise<number> {
  const subs = await listSubs();
  if (!subs.length) return 0;
  const { publicKey, privateKey } = await getVapid();
  webpush.setVapidDetails(cfg.appUrl.startsWith("https://") ? cfg.appUrl : "mailto:pulse@example.com", publicKey, privateKey);
  const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url ?? "/", tag: note.id });
  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, payload, { TTL: note.urgent ? 900 : 3 * 3600, urgency: note.urgent ? "high" : "normal" });
        ok++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await removeSub(s.endpoint);
      }
    }),
  );
  return ok;
}
