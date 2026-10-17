import type { SourceState } from "./types";

/** Errors a data source can raise. `off` = not configured, `reconnect` = auth needs redoing. */
export class SourceError extends Error {
  constructor(
    public state: Exclude<SourceState, "ok">,
    message: string,
  ) {
    super(message);
  }
}

export function toState(e: unknown): { state: Exclude<SourceState, "ok">; message: string } {
  if (e instanceof SourceError) return { state: e.state, message: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  return { state: "error", message: msg.slice(0, 160) };
}

/** fetch + JSON with a timeout, for the non-Google sources. */
export async function fetchJson<T = any>(url: string, init: RequestInit = {}, timeoutMs = 9000): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (res.status === 401 || res.status === 403) {
    throw new SourceError("reconnect", body?.message ?? body?.error ?? `Token rejected (${res.status}) — generate a new one`);
  }
  if (!res.ok) throw new SourceError("error", body?.message ?? body?.error ?? `HTTP ${res.status}`);
  return body as T;
}
