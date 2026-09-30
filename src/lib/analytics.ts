import { API_BASE_URL } from "./config";
import { trackPromoFollowUp } from "./promo-session";
import type { BusinessEventType } from "./types";

/**
 * Phase 3 — fire-and-forget first-party event tracking. Nothing here is ever
 * awaited by a caller, and every path swallows its own errors, so tracking can
 * never delay page rendering, a phone dial, a WhatsApp jump, directions, or an
 * outbound link.
 *
 * Transport: fetch({ keepalive: true }) — non-blocking, survives the navigation
 * that a phone/WhatsApp/directions/website click triggers, and (unlike a
 * cross-origin sendBeacon with a JSON body) negotiates CORS cleanly. A
 * same-origin sendBeacon is tried first only as an optimisation.
 */

const SID_KEY = "rp:sid";
const VIEW_TTL_MS = 30 * 60 * 1000; // 30 min — matches the server-side PROFILE_VIEW dedupe window

/** Opaque, non-identifying per-tab id used only to de-duplicate PROFILE_VIEW. */
function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let sid = window.sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null; // private mode / storage disabled — tracking still works, just without dedupe id
  }
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function post(businessId: string, eventType: BusinessEventType): void {
  if (typeof window === "undefined") return;
  const url = `${API_BASE_URL}/api/v1/businesses/${businessId}/events`;
  const payload = JSON.stringify({ eventType, sessionId: getSessionId() });

  // Same-origin: a beacon is the lightest option and best survives unload.
  try {
    if (isSameOrigin(url) && navigator.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))) return;
    }
  } catch {
    /* fall through */
  }

  // Cross-origin (dev) or beacon unavailable: keepalive fetch, never awaited.
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      // no credentials — this endpoint is public and takes nothing user-specific
    }).catch(() => {});
  } catch {
    /* give up silently */
  }
}

/** Business-page actions that also count as a promotion follow-up when the visitor came from one (V58). */
const PROMO_FOLLOW_UP: Partial<Record<BusinessEventType, "CALL" | "DIRECTIONS" | "MESSAGE">> = {
  PHONE_CLICK: "CALL",
  DIRECTIONS_CLICK: "DIRECTIONS",
  WHATSAPP_CLICK: "MESSAGE",
};

/** Track a deliberate interaction (phone / WhatsApp / directions / website click). */
export function trackEvent(businessId: string, eventType: BusinessEventType): void {
  post(businessId, eventType);
  const promo = PROMO_FOLLOW_UP[eventType];
  if (promo) trackPromoFollowUp(businessId, promo);
}

/**
 * Track a genuine profile view, at most once per ~30 min per business per tab —
 * so React re-renders, StrictMode double-effects, remounts, and tab switches
 * don't inflate the count. A real revisit after the window still counts.
 */
export function trackProfileView(businessId: string): void {
  if (typeof window === "undefined") return;
  const key = `rp:pv:${businessId}`;
  try {
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last < VIEW_TTL_MS) return;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable — fall through and still record the view */
  }
  post(businessId, "PROFILE_VIEW");
  trackPromoFollowUp(businessId, "PROFILE_VISIT");
}
