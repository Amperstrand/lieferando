import { isTransportFailure } from "./error.js";

export const CDN_BASE = "https://globalmenucdn.eu-central-1.production.jet-external.com";
export const USER_AGENT = "lieferando/0.1";

/**
 * The menu CDN is open static JSON — no auth, no cookies, no WAF (the
 * Cloudflare gate only guards the app shell). One polite GET per file.
 */
export function cdnUrl(fileName: string): string {
  return `${CDN_BASE}/${fileName}`;
}

export interface JsonResult<T> {
  readonly ok: true;
  readonly value: T;
}

export interface JsonFailure {
  readonly ok: false;
  /** "http" = answered with an error status (404 = unknown slug); "network" = transport death. */
  readonly kind: "http" | "network";
  readonly status: number;
  readonly body: string;
}

export type FetchJsonResult<T> = JsonResult<T> | JsonFailure;

export async function fetchJson<T>(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchJsonResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return {
      ok: false,
      kind: "network",
      status: 0,
      body: error instanceof Error ? error.message : String(error),
    };
  }
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, kind: "http", status: response.status, body: text.slice(0, 300) };
  }
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, kind: "http", status: response.status, body: text.slice(0, 300) };
  }
}
