// One Google sign-in covers Fitbit (Google Health API), Calendar and Gmail.

import { cfg } from "./config";
import { store } from "./store";
import { SourceError } from "./errors";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  refresh_expires_at: number | null; // ms — Google caps this at 7 days while the OAuth app is in "Testing"
  scope: string;
}

const KEY = "google:tokens";
export const redirectUri = () => `${cfg.appUrl}/api/google/callback`;
export const googleConfigured = () => Boolean(cfg.google.clientId && cfg.google.clientSecret);

export function authUrl(state: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", cfg.google.clientId!);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent"); // always re-issue a refresh token
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.google.clientId!,
      client_secret: cfg.google.clientSecret!,
      ...body,
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new SourceError(json.error === "invalid_grant" ? "reconnect" : "error", json.error_description ?? json.error ?? `Google token error ${res.status}`);
    throw err;
  }
  return json;
}

export async function exchangeCode(code: string) {
  const j = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const prev = await store.get<Tokens>(KEY);
  const t: Tokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (j.expires_in - 60) * 1000,
    refresh_expires_at: j.refresh_token_expires_in ? Date.now() + j.refresh_token_expires_in * 1000 : null,
    scope: j.scope ?? "",
  };
  if (!t.refresh_token) throw new SourceError("error", "Google didn't return a refresh token — try connecting again.");
  await store.set(KEY, t);
  return t;
}

export async function googleStatus() {
  const t = await store.get<Tokens>(KEY).catch(() => null);
  const expired = t?.refresh_expires_at != null && t.refresh_expires_at < Date.now();
  return {
    connected: Boolean(t?.refresh_token) && !expired,
    refreshExpiresAt: t?.refresh_expires_at ? new Date(t.refresh_expires_at).toISOString() : null,
    scopes: t?.scope.split(" ") ?? [],
  };
}

export async function disconnectGoogle() {
  await store.del(KEY);
}

let inflight: Promise<string> | null = null;

async function accessToken(force = false): Promise<string> {
  if (!googleConfigured()) throw new SourceError("off", "Google client ID/secret not set");
  const t = await store.get<Tokens>(KEY);
  if (!t?.refresh_token) throw new SourceError("reconnect", "Connect your Google account");
  if (!force && t.access_token && t.expires_at > Date.now()) return t.access_token;
  inflight ??= (async () => {
    try {
      const j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
      await store.set(KEY, {
        ...t,
        access_token: j.access_token,
        expires_at: Date.now() + (j.expires_in - 60) * 1000,
        refresh_token: j.refresh_token ?? t.refresh_token,
      });
      return j.access_token as string;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** fetch() against a Google API with auth + one automatic retry on an expired token. */
export async function gjson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(attempt > 0);
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
