// Bearer-token auth for non-browser clients (alarm Shortcut, cron, the iOS widget app).
// Constant-time compare; never enabled when BRIEF_TOKEN isn't set.

import { createHash, timingSafeEqual } from "crypto";
import { cfg } from "./config";

export function tokenOk(req: Request, allowQuery = false): boolean {
  if (!cfg.briefToken) return false;
  const header = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const got = header || (allowQuery ? (new URL(req.url).searchParams.get("key") ?? "") : "");
  const h = (s: string) => createHash("sha256").update(s).digest();
  return got.length > 0 && timingSafeEqual(h(got), h(cfg.briefToken));
}
