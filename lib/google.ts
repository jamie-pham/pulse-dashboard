// Google sign-ins.
//  • The primary account (the one your Fitbit Air uses) covers health + its calendar + its Gmail.
//  • Extra accounts (Monash, work, …) are calendar + Gmail only, and merge into the same timeline/inbox.

import { cfg } from "./config";
import { store } from "./store";
import { SourceError } from "./errors";

const CAL = "https://www.googleapis.com/auth/calendar.readonly";
const GMAIL = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  CAL,
  GMAIL,
];
export const EXTRA_SCOPES = ["openid", "email", CAL, GMAIL];

export type Mode = "primary" | "add";
/** "primary" or an extra account's email address. */
export type Slot = string;
export const PRIMARY: Slot = "primary";

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  refresh_expires_at: number | null; // ms — Google caps this at 7 days while the OAuth app is in "Testing"
  scope: string;
  email?: string;
}

const PRIMARY_KEY = "google:tokens";
const INDEX_KEY = "google:accounts";
const keyFor = (slot: Slot) => (slot === PRIMARY ? PRIMARY_KEY : `google:acct:${slot.toLowerCase()}`);

export const redirectUri = () => `${cfg.appUrl}/api/google/callback`;
export const googleConfigured = () => Boolean(cfg.google.clientId && cfg.google.clientSecret);

export function authUrl(state: string, mode: Mode = "primary"): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", cfg.google.clientId!);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", (mode === "add" ? EXTRA_SCOPES : GOOGLE_SCOPES).join(" "));
  u.searchParams.set("access_type", "offline");
  // Always re-issue a refresh token; for extra accounts, always show the account chooser.
  u.searchParams.set("prompt", mode === "add" ? "consent select_account" : "consent");
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.google.clientId!, client_secret: cfg.google.clientSecret!, ...body }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SourceError(
      json.error === "invalid_grant" ? "reconnect" : "error",
      json.error_description ?? json.error ?? `Google token error ${res.status}`,
    );
  }
  return json;
}

/** The email inside the id_token Google returns with the code exchange (came straight from Google over TLS). */
export function emailFromIdToken(idToken?: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export async function listAccounts(): Promise<string[]> {
  return ((await store.get<string[]>(INDEX_KEY).catch(() => null)) ?? []).filter(Boolean);
}

export async function exchangeCode(code: string, mode: Mode = "primary"): Promise<{ email?: string; slot: Slot }> {
  const j = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const email = emailFromIdToken(j.id_token);
  const primary = await store.get<Tokens>(PRIMARY_KEY).catch(() => null);

  // Adding the same account as the primary one just refreshes the primary sign-in.
  let slot: Slot = mode === "add" && email && email !== primary?.email ? email : PRIMARY;
  if (mode === "add" && !email) throw new SourceError("error", "Google didn't say which account that was — try again.");

  const prev = await store.get<Tokens>(keyFor(slot)).catch(() => null);
  const t: Tokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (j.expires_in - 60) * 1000,
    refresh_expires_at: j.refresh_token_expires_in ? Date.now() + j.refresh_token_expires_in * 1000 : null,
    scope: j.scope ?? "",
    email: email ?? prev?.email,
  };
  if (!t.refresh_token) throw new SourceError("error", "Google didn't return a refresh token — try connecting again.");
  await store.set(keyFor(slot), t);

  if (slot !== PRIMARY) {
    const idx = new Set(await listAccounts());
    idx.add(slot);
    await store.set(INDEX_KEY, [...idx]);
  } else if (email) {
    // If this account had been added as an extra before, it's the primary now.
    const idx = (await listAccounts()).filter((e) => e !== email);
    await store.set(INDEX_KEY, idx);
    await store.del(keyFor(email)).catch(() => {});
  }
  return { email, slot };
}

export async function removeAccount(email: string) {
  await store.del(keyFor(email));
  await store.set(INDEX_KEY, (await listAccounts()).filter((e) => e !== email.toLowerCase()));
}

export interface AccountStatus {
  slot: Slot;
  email: string | null;
  connected: boolean;
  refreshExpiresAt: string | null;
}

async function statusOf(slot: Slot): Promise<AccountStatus> {
  const t = await store.get<Tokens>(keyFor(slot)).catch(() => null);
  const expired = t?.refresh_expires_at != null && t.refresh_expires_at < Date.now();
  return {
    slot,
    email: t?.email ?? (slot === PRIMARY ? null : slot),
    connected: Boolean(t?.refresh_token) && !expired,
    refreshExpiresAt: t?.refresh_expires_at ? new Date(t.refresh_expires_at).toISOString() : null,
  };
}

/** Primary first, then extras. */
export async function allAccountStatus(): Promise<AccountStatus[]> {
  return Promise.all([PRIMARY, ...(await listAccounts())].map(statusOf));
}

export async function googleStatus() {
  const all = await allAccountStatus();
  const primary = all[0];
  const expiries = all.map((a) => a.refreshExpiresAt).filter(Boolean) as string[];
  return {
    connected: primary.connected,
    refreshExpiresAt: expiries.sort()[0] ?? null, // soonest expiry across every account
    accounts: all,
  };
}

/** Learn the primary account's email if it was connected before we stored emails. */
export async function ensurePrimaryEmail(): Promise<string | null> {
  const t = await store.get<Tokens>(PRIMARY_KEY).catch(() => null);
  if (!t) return null;
  if (t.email) return t.email;
  try {
    const p = await gjson("https://gmail.googleapis.com/gmail/v1/users/me/profile");
    const email = String(p.emailAddress ?? "").toLowerCase() || undefined;
    if (email) await store.set(PRIMARY_KEY, { ...(await store.get<Tokens>(PRIMARY_KEY)), email });
    return email ?? null;
  } catch {
    return null;
  }
}

const inflight = new Map<Slot, Promise<string>>();

async function accessToken(slot: Slot, force = false): Promise<string> {
  if (!googleConfigured()) throw new SourceError("off", "Google client ID/secret not set");
  const t = await store.get<Tokens>(keyFor(slot));
  if (!t?.refresh_token) throw new SourceError("reconnect", slot === PRIMARY ? "Connect your Google account" : `Reconnect ${slot}`);
  if (!force && t.access_token && t.expires_at > Date.now()) return t.access_token;
  let p = inflight.get(slot);
  if (!p) {
    p = (async () => {
      try {
        const j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
        await store.set(keyFor(slot), {
          ...t,
          access_token: j.access_token,
          expires_at: Date.now() + (j.expires_in - 60) * 1000,
          refresh_token: j.refresh_token ?? t.refresh_token,
        });
        return j.access_token as string;
      } finally {
        inflight.delete(slot);
      }
    })();
    inflight.set(slot, p);
  }
  return p;
}

/** fetch() against a Google API as one of your accounts, with one automatic retry on an expired token. */
export async function gjson<T = any>(url: string, init: RequestInit = {}, slot: Slot = PRIMARY): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(slot, attempt > 0);
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401 && attempt === 0) continue;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      const reason = JSON.stringify(body?.error?.details ?? "");
      if (res.status === 403 && /MISSING_OAUTH_SCOPE|insufficient/i.test(msg + reason)) {
        throw new SourceError("reconnect", "Missing permission — reconnect Google and tick every box");
      }
      throw new SourceError("error", msg);
    }
    return body as T;
  }
  throw new SourceError("reconnect", "Google sign-in expired");
}
