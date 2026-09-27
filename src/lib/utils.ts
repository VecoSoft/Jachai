import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Shared focus-visible style — every interactive element (Button, IconButton, Chip,
 *  and any hand-rolled control) should include this so keyboard users always get a
 *  visible ring, not just the handful of components that happened to have one. */
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson-500";

/** Shared motion style for interactive elements — only the properties that actually
 *  change (color/background/border/transform/opacity), not `transition-all`, so a
 *  toggle never animates layout properties like width/height by accident. */
export const interactiveTransition = "transition-[color,background-color,border-color,transform,opacity] duration-150 ease-out";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return iso;
  const diffSec = Math.round((Date.now() - date) / 1000);
  const table: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = diffSec;
  let unit = "s";
  for (const [size, u] of table) {
    if (value < size) {
      unit = u;
      break;
    }
    value = Math.floor(value / size);
    unit = u;
  }
  if (diffSec < 60) return "just now";
  return `${value}${unit} ago`;
}

/** Same rough-unit style as timeAgo, but for a future timestamp (e.g. a poll's closesAt). */
export function timeUntil(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "";
  const diffSec = Math.round((date - Date.now()) / 1000);
  if (diffSec <= 0) return "Closed";
  const table: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [Number.POSITIVE_INFINITY, "w"],
  ];
  let value = diffSec;
  let unit = "s";
  for (const [size, u] of table) {
    if (value < size) {
      unit = u;
      break;
    }
    value = Math.floor(value / size);
    unit = u;
  }
  if (diffSec < 60) return "Closes in less than a minute";
  return `Closes in ${value}${unit}`;
}

/**
 * Normalizes a Bangladeshi phone number to E.164 (+8801XXXXXXXXX), matching
 * the backend's PhoneNumberUtils normalization. Accepts local (01XXXXXXXXX),
 * with-country-code (8801XXXXXXXXX), or already-E.164 (+8801XXXXXXXXX) input.
 */
export function normalizeBdPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("880")) return `+${digits}`;
  if (digits.startsWith("0")) return `+880${digits.slice(1)}`;
  if (digits.startsWith("1")) return `+880${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export function isValidBdPhone(raw: string): boolean {
  const normalized = normalizeBdPhone(raw);
  return /^\+8801[3-9]\d{8}$/.test(normalized);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function truncateId(id: string, len = 8): string {
  return id ? id.slice(0, len) : id;
}

const AVATAR_COLORS = ["bg-brand-600", "bg-crimson-600", "bg-gold-600", "bg-ink-500"];

/** First letter(s) of a display name for a fallback avatar badge, e.g. "Sean W." -> "SW". */
export function avatarInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Deterministic color per seed (name or id) so the same person's fallback avatar stays consistent. */
export function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** 1,234 -> "1.2k"; below 1000, the plain number. Used next to RatingBoxes for a review/rating count. */
export function formatReviewCount(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}
