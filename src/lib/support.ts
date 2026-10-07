import type { SupportCategory, SupportStatus } from "./types";

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  ACCOUNT: "Account",
  ORDER: "Order",
  BOOKING: "Booking",
  LISTING: "Listing",
  PAYMENT: "Payment",
  OTHER: "Other",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  OPEN: "Open",
  PENDING: "Waiting for you",
  RESOLVED: "Resolved",
};

export function supportStatusTone(status: SupportStatus): "brand" | "gold" | "neutral" {
  return status === "RESOLVED" ? "brand" : status === "PENDING" ? "gold" : "neutral";
}
