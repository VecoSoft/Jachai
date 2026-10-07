export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8085";

export const PAGE_SIZE = 20;

export const PRICE_TIER_LABELS: Record<string, string> = {
  BUDGET: "৳ Budget",
  MODERATE: "৳৳ Moderate",
  EXPENSIVE: "৳৳৳ Expensive",
  VERY_EXPENSIVE: "৳৳৳৳ Very expensive",
};

const PRICE_TIER_LABELS_BN: Record<string, string> = {
  BUDGET: "৳ সাশ্রয়ী",
  MODERATE: "৳৳ মাঝারি",
  EXPENSIVE: "৳৳৳ ব্যয়বহুল",
  VERY_EXPENSIVE: "৳৳৳৳ অতি ব্যয়বহুল",
};

/**
 * Language-aware price tier label — PRICE_TIER_LABELS above stays English-only
 * and unchanged (business-filters.tsx's manual sort/filter dropdown still uses
 * it directly), so this is additive for call sites that display the tier as
 * badge/description text rather than a filter option.
 */
export function priceTierLabel(tier: string, lang: "en" | "bn"): string {
  return (lang === "bn" ? PRICE_TIER_LABELS_BN[tier] : PRICE_TIER_LABELS[tier]) ?? PRICE_TIER_LABELS[tier] ?? tier;
}

export const SORT_LABELS: Record<string, string> = {
  relevance: "Relevance",
  newest: "Newest",
  rating: "Highest rated",
  distance: "Nearest",
  most_reviewed: "Most reviewed",
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  FAKE: "Fake",
  OFFENSIVE: "Offensive",
  OTHER: "Other",
};

export const VOTE_TYPE_LABELS: Record<string, string> = {
  USEFUL: "Useful",
  FUNNY: "Funny",
  COOL: "Cool",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTION_TAKEN: "Action taken",
  DISMISSED: "Dismissed",
  DUPLICATE: "Duplicate",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  REPORT_SUBMITTED: "Report submitted",
  REPORT_ACTION_TAKEN: "Report resolved",
  REPORT_DISMISSED: "Report resolved",
  CONTENT_HIDDEN: "Review removed",
  LISTING_FLAGGED: "Listing flagged",
  FLAG_REVIEW_REQUESTED: "Flag review requested",
  NEW_ORDER: "New order",
  ORDER_ACCEPTED: "Order accepted",
  ORDER_REJECTED: "Order rejected",
  ORDER_STATUS_CHANGED: "Order update",
  NEW_BOOKING: "New booking request",
  BOOKING_CONFIRMED: "Booking confirmed",
  BOOKING_REJECTED: "Booking rejected",
  BOOKING_STATUS_CHANGED: "Booking update",
  OFFER_CLAIMED: "Offer claimed",
  OFFER_REDEEMED: "Offer redeemed",
  OFFER_APPROVED: "Offer approved",
  OFFER_REJECTED: "Offer rejected",
  ADMIN_NOTICE: "From Jachai",
  BROADCAST: "Announcement",
  SUPPORT_REPLY: "Support reply",
};
