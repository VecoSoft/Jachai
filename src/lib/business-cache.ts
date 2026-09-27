import type { BusinessCardData, BusinessResponse, CachedBusinessSummary } from "./types";

// The backend's Bookmark, MessageThread etc. records only carry a raw
// businessId (UUID) — there's no endpoint to fetch a business by id (only by
// slug), so screens like "My Bookmarks" or "My Message Threads" have nothing
// to render a name/photo from on their own. As a pragmatic frontend-only
// bridge, every full BusinessResponse we see anywhere in the app (search
// results, a business profile page) gets mirrored into this localStorage
// cache keyed by id. Screens that only have a businessId look it up here;
// if it's missing (e.g. cache cleared, or bookmarked before ever being
// viewed in this browser), we fall back to showing the raw id.

const CACHE_KEY = "rp.businessCache.v1";

function readCache(): Record<string, CachedBusinessSummary> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedBusinessSummary>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors — this is a best-effort convenience cache
  }
}

function toSummary(business: BusinessResponse): CachedBusinessSummary {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    coverPhotoUrl: business.coverPhotoUrl,
    categoryName: business.categoryName,
    areaName: business.areaName,
    cityName: business.cityName,
    priceTier: business.priceTier,
    verified: business.verified,
    averageRating: business.averageRating,
    reviewCount: business.reviewCount,
    latitude: business.latitude,
    longitude: business.longitude,
    branchCount: business.branchCount,
  };
}

export function rememberBusiness(business: BusinessResponse) {
  const cache = readCache();
  cache[business.id] = toSummary(business);
  writeCache(cache);
}

export function rememberBusinesses(businesses: BusinessResponse[]) {
  if (!businesses.length) return;
  const cache = readCache();
  for (const b of businesses) {
    cache[b.id] = toSummary(b);
  }
  writeCache(cache);
}

export function lookupBusiness(id: string): CachedBusinessSummary | null {
  return readCache()[id] ?? null;
}

/**
 * Adapts a cache entry to BusinessCard's props — or null when the entry predates the
 * rating/price fields (an old cache write, or one that only ever saw a business through
 * a code path that didn't call rememberBusiness at all), which isn't enough to render the
 * marketplace-style card without faking data the cache never actually had.
 */
export function toBusinessCardData(cached: CachedBusinessSummary): BusinessCardData | null {
  if (cached.priceTier === undefined || cached.averageRating === undefined || cached.reviewCount === undefined) {
    return null;
  }
  return {
    id: cached.id,
    name: cached.name,
    slug: cached.slug,
    categoryName: cached.categoryName,
    areaName: cached.areaName,
    cityName: cached.cityName,
    photoUrls: cached.coverPhotoUrl ? [cached.coverPhotoUrl] : [],
    priceTier: cached.priceTier,
    verified: cached.verified ?? false,
    averageRating: cached.averageRating,
    reviewCount: cached.reviewCount,
    flagged: false,
    flagReason: null,
    branchCount: cached.branchCount ?? null,
    structuredHours: null,
    hoursExceptions: null,
    latitude: cached.latitude ?? null,
    longitude: cached.longitude ?? null,
  };
}
