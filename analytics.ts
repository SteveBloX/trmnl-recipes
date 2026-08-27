// Umami server-side events — https://docs.umami.is/docs/guides/send-server-side-events
//
// Fire-and-forget by design: a broken analytics call must never slow down or
// fail an actual API response. Every call site does `trackEvent(...)` without
// awaiting it, and errors here are swallowed (logged, not thrown).
import "dotenv/config";
import { getLogger } from "./logger";

const log = getLogger("analytics");

const UMAMI_HOST_URL = (process.env.UMAMI_HOST_URL || "").replace(/\/+$/, "");
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "";

// Same domain everywhere else in this codebase hardcodes for the public
// TRMNL-facing URLs (settings.yml polling_url, the animal page link) — kept
// as a constant rather than another env var to match that convention.
const PUBLIC_HOSTNAME = "trmnl.bloax.xyz";

// Umami rejects any request without a User-Agent outright — but it doesn't
// stop there. Its bot detection also silently drops requests whose UA looks
// non-browser (a custom string, or even the "Mozilla/5.0 (Server)" example
// from Umami's own docs): it still answers 200, but with a decoy body
// (`{"beep":"boop"}`) instead of the real `{cache, sessionId, visitId}`
// payload, so a bot can't tell it was caught. Verified empirically against
// this deployment — a real browser UA is the only one that isn't decoyed.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Records one event server-side. Silently does nothing if UMAMI_HOST_URL /
 * UMAMI_WEBSITE_ID aren't configured, so this is always safe to call.
 * @param name short event identifier, e.g. "api_request"
 * @param url the path the event happened on, e.g. "/api/daily-animal"
 * @param data optional extra properties (e.g. { endpoint: "daily-animal" })
 */
export async function trackEvent(
  name: string,
  url: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!UMAMI_HOST_URL || !UMAMI_WEBSITE_ID) return;

  try {
    const res = await fetch(`${UMAMI_HOST_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: UMAMI_WEBSITE_ID,
          hostname: PUBLIC_HOSTNAME,
          url,
          name,
          ...(data ? { data } : {}),
        },
      }),
    });
    if (!res.ok) {
      log.warn(
        `Umami event '${name}' rejected: ${res.status} ${await res.text()}`,
      );
      return;
    }
    // A 200 doesn't guarantee the event was recorded: Umami's bot detection
    // answers with this decoy body instead of rejecting outright, precisely
    // so a bot can't distinguish success from being caught.
    const body = await res.text();
    if (body.includes('"beep"')) {
      log.warn(
        `Umami event '${name}' silently dropped (bot detection): ${body}`,
      );
    }
  } catch (error: any) {
    log.warn(`Umami event '${name}' failed:`, error.message);
  }
}
