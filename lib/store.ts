// Tiny key-value store. Upstash Redis in production (free tier is plenty);
// a local JSON file in development so you can run it with zero setup.

import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import { cfg, isProd } from "./config";

interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class RedisKV implements KV {
  private r = new Redis({ url: cfg.redis.url!, token: cfg.redis.token! });
  async get<T>(key: string) {
    return (await this.r.get<T>(`pulse:${key}`)) ?? null;
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    if (ttlSec) await this.r.set(`pulse:${key}`, value, { ex: ttlSec });
    else await this.r.set(`pulse:${key}`, value);
  }
  async del(key: string) {
    await this.r.del(`pulse:${key}`);
  }
}

type Entry = { v: unknown; exp?: number };
class FileKV implements KV {
  private file = path.join(process.cwd(), ".data", "store.json");
  private async load(): Promise<Record<string, Entry>> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  private async save(d: Record<string, Entry>) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(d));
  }
  async get<T>(key: string) {
    const e = (await this.load())[key];
    if (!e || (e.exp && e.exp < Date.now())) return null;
    return e.v as T;
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    const d = await this.load();
    d[key] = { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined };
    await this.save(d);
  }
  async del(key: string) {
    const d = await this.load();
    delete d[key];
    await this.save(d);
  }
}

export const storeConfigured = Boolean(cfg.redis.url && cfg.redis.token);
export const store: KV = storeConfigured ? new RedisKV() : new FileKV();
/** On Vercel the filesystem is read-only, so production needs Redis for anything to persist. */
export const storeUsable = storeConfigured || !isProd;

// Cache keys carry a generation number, so "clear everything" (e.g. after connecting an account) is one write.
let genMemo: { v: number; at: number } | null = null;
async function cacheGen(): Promise<number> {
  if (genMemo && Date.now() - genMemo.at < 5000) return genMemo.v;
  const v = (await store.get<number>("cache:gen").catch(() => null)) ?? 0;
  genMemo = { v, at: Date.now() };
  return v;
}

export async function clearCache() {
  const v = (await cacheGen()) + 1;
  await store.set("cache:gen", v);
  genMemo = { v, at: Date.now() };
}

/** Cache a slow call for a few minutes so refreshing the app is instant. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>, force = false): Promise<T> {
  const k = `cache:${await cacheGen()}:${key}`;
  if (!force) {
    const hit = await store.get<T>(k).catch(() => null);
    if (hit != null) return hit;
  }
  const v = await fn();
  await store.set(k, v, ttlSec).catch(() => {});
  return v;
}
