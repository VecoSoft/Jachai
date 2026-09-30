import { API_BASE_URL } from "./config";
import type { PromoEventType, PromoSource } from "./types";

/**
 * Client side of promotion analytics (V58). Nothing here identifies a person:
 *  - a random per-browser promo session id (the server only ever stores a daily-rotating hash of it),
 *  - short-lived attribution ("this visitor came from business post X") kept in sessionStorage so a
 *    later claim / order / booking / call on that business can be credited to the post,
 *  - a batched beacon for impressions/clicks/shares (deduped server-side for 30 minutes),
 *  - "Hide this ad" choices, kept locally.
 * Every storage access is best-effort: private mode or blocked storage just means no attribution.
 */

const SESSION_KEY = "jachai.promoSession";
const ATTRIBUTION_KEY = "jachai.promoAttribution";
const HIDDEN_KEY = "jachai.hiddenAds";
const ATTRIBUTION_TTL_MS = 2 * 60 * 60 * 1000;
const FLUSH_MS = 4000;
const MAX_BATCH = 20;

export interface PromoAttribution {
  businessId: string;
  postId: string;
  boostId?: string | null;
  offerId?: string | null;
  ref: string;
  source: PromoSource;
  at: number;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getPromoSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function promoSessionHeaders(): Record<string, string> {
  const id = getPromoSessionId();
  return id ? { "X-Promo-Session": id } : {};
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

function readAttributions(): PromoAttribution[] {
  try {
    const list = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) ?? "[]") as PromoAttribution[];
    const now = Date.now();
    return Array.isArray(list) ? list.filter((a) => a && now - a.at < ATTRIBUTION_TTL_MS) : [];
  } catch {
    return [];
  }
}

/** Remember that the visitor engaged with a business post (CTA click, share-link landing). */
export function rememberAttribution(a: Omit<PromoAttribution, "at">) {
  if (typeof window === "undefined") return;
  try {
    const rest = readAttributions().filter((x) => x.businessId !== a.businessId);
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify([{ ...a, at: Date.now() }, ...rest].slice(0, 10)));
  } catch {
    // ignore
  }
}

export function attributionFor(match: { businessId?: string | null; offerId?: string | null }): PromoAttribution | null {
  if (typeof window === "undefined") return null;
  const list = readAttributions();
  return (
    (match.offerId && list.find((a) => a.offerId === match.offerId)) ||
    (match.businessId && list.find((a) => a.businessId === match.businessId)) ||
    null
  );
}

/** Query params the backend reads to credit a claim / order / booking to the post it came from. */
export function attributionQuery(match: { businessId?: string | null; offerId?: string | null }): Record<string, string | undefined> {
  const a = attributionFor(match);
  if (!a) return {};
  return { promoPostId: a.postId, promoBoostId: a.boostId ?? undefined, promoRef: a.ref };
}

// ---------------------------------------------------------------------------
// Beacon
// ---------------------------------------------------------------------------

interface QueuedEvent {
  postId: string;
  boostId?: string | null;
  event: PromoEventType;
  source: PromoSource;
  ref?: string | null;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let unloadHooked = false;

function payload(events: QueuedEvent[]): string {
  return JSON.stringify({ session: getPromoSessionId(), events });
}

function flush(useBeacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const url = `${API_BASE_URL}/api/v1/promo/public/events`;
  // text/plain is a CORS-safelisted type, so sendBeacon works cross-origin (the backend accepts it).
  const body = payload(events);
  try {
    if (useBeacon && navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    // fall through
  }
  void fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
}

export function trackPromo(event: PromoEventType, e: Omit<QueuedEvent, "event">) {
  if (typeof window === "undefined" || !e.postId) return;
  queue.push({ ...e, event });
  if (!unloadHooked) {
    unloadHooked = true;
    window.addEventListener("pagehide", () => flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
  }
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
}

/**
 * Follow-up actions on a business page (call / directions / message / profile visit) count for the
 * promotion only when this visitor arrived from one (attribution still fresh).
 */
export function trackPromoFollowUp(businessId: string, event: Extract<PromoEventType, "PROFILE_VISIT" | "CALL" | "DIRECTIONS" | "MESSAGE">) {
  const a = attributionFor({ businessId });
  if (a) trackPromo(event, { postId: a.postId, boostId: a.boostId, source: a.source, ref: a.ref });
}

// ---------------------------------------------------------------------------
// "Hide this ad"
// ---------------------------------------------------------------------------

export function hiddenAds(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function hideAd(boostId: string) {
  try {
    const set = hiddenAds();
    set.add(boostId);
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // ignore
  }
}
