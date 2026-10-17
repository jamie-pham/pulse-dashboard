// Single-user password gate. The cookie is an HMAC-signed expiry timestamp — no user table needed.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cfg, isProd } from "./config";

export const COOKIE = "pulse_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days — you shouldn't have to log in on your phone often

function sign(payload: string) {
  return createHmac("sha256", cfg.sessionSecret ?? "dev-only-secret").update(payload).digest("base64url");
}

export function makeToken(): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token?: string): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(pw: string): boolean {
  if (!cfg.password) return false;
  const a = Buffer.from(createHmac("sha256", "pw").update(pw).digest());
  const b = Buffer.from(createHmac("sha256", "pw").update(cfg.password).digest());
  return timingSafeEqual(a, b);
}

/** What the app should do about auth right now. */
export function authMode(): "open" | "password" | "misconfigured" {
  if (cfg.password && cfg.sessionSecret) return "password";
  if (cfg.password && !isProd) return "password";
  if (!isProd) return "open"; // local dev with no password set
  return "misconfigured";
}

export async function isAuthed(): Promise<boolean> {
  const mode = authMode();
  if (mode === "open") return true;
  if (mode === "misconfigured") return false;
  return verifyToken((await cookies()).get(COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
