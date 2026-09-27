"use client";

import { useState, type TouchEvent } from "react";
import { getOpenStatus } from "@/lib/business-hours";
import { PRICE_TIER_LABELS } from "@/lib/config";
import { useUserLocation } from "@/lib/location-context";
import type { BusinessResponse } from "@/lib/types";
import { cn, distanceKm, focusRing, formatDistance, interactiveTransition } from "@/lib/utils";
import { BranchSwitcher } from "./branch-switcher";
import { GalleryImage } from "./gallery-image";
import { PhotoGalleryModal } from "./photo-gallery-modal";
import { StarDisplay } from "./star-rating";
import { VerifiedBadge } from "./verified-badge";

// Cinematic bottom gradient — brighter at the top so the photo itself stays
// visible, dark enough at the bottom to carry large white type. Four stops
// needed for the falloff Tailwind's 3-stop from/via/to utilities can't
// express, so this is plain CSS rather than gradient utility classes.
const HERO_GRADIENT = {
  backgroundImage:
    "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 25%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 80%)",
};

/**
 * Business detail page hero — full viewport width (breaks out of the
 * page's centered max-w-7xl container via a negative-margin technique, a
 * scoped CSS trick rather than restructuring the shared site layout that
 * every other route also uses). Desktop (lg+) shows a Yelp-style photo
 * strip — the first 5 photos side by side, business identity overlaid on
 * the first tile, "See all N photos" on the last. Below lg a 5-way strip
 * is unreadable, so it falls back to the single swipeable cinematic photo
 * (same as Yelp's own mobile behavior).
 */
export function BusinessHeroGallery({ business }: { business: BusinessResponse }) {
  const { status: locationStatus, coords, request } = useUserLocation();
  const photos = business.photoUrls;
  const stripPhotos = photos.slice(0, 5);
  const [heroIndex, setHeroIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  function shift(delta: number) {
    setHeroIndex((i) => (i + delta + photos.length) % photos.length);
  }

  function openPhotoAt(index: number) {
    setLightboxIndex(index);
    setGalleryOpen(true);
  }

  function openLightbox() {
    openPhotoAt(heroIndex);
  }

  function openGrid() {
    setLightboxIndex(null);
    setGalleryOpen(true);
  }

  function onTouchStart(e: TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }
  function onTouchEnd(e: TouchEvent) {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) shift(delta < 0 ? 1 : -1);
    setTouchStartX(null);
  }

  const distance =
    locationStatus === "granted" && coords
      ? formatDistance(distanceKm(coords, { lat: business.latitude, lng: business.longitude }))
      : null;

  // Business identity block, overlaid on the gradient — headingClass differs between the
  // full-width single-photo hero (room to scale up to 6xl) and a photo-strip's narrower
  // first tile (capped smaller so the name doesn't overflow it).
  const openStatus = getOpenStatus(business.structuredHours, business.hoursExceptions);

  function renderIdentity(headingClass: string) {
    return (
      <div className="max-w-[900px]">
        <h1 className={cn("font-display font-extrabold text-white leading-[1.05] drop-shadow-sm break-words line-clamp-3", headingClass)}>
          {business.name}
        </h1>

        <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StarDisplay rating={business.averageRating} size="lg" />
          <span className="text-lg sm:text-xl font-bold text-white">{business.averageRating.toFixed(1)}</span>
          <a
            href="#reviews"
            className="pointer-events-auto text-sm sm:text-lg text-white/80 hover:text-white hover:underline"
          >
            ({business.reviewCount} {business.reviewCount === 1 ? "review" : "reviews"})
          </a>
        </div>

        <div className="mt-2 sm:mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-y-1.5 text-sm sm:text-lg text-white/90 drop-shadow-sm">
          {openStatus && (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold shadow-sm",
                  openStatus.open ? "bg-emerald-500 text-white" : "bg-ink-700/90 text-white"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {openStatus.open ? "Open now" : "Closed"}
                {openStatus.changesAt && (
                  <span className="font-normal opacity-90">
                    {openStatus.open ? `until ${openStatus.changesAt}` : `opens ${openStatus.changesAt}`}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-white/50">
                ·
              </span>
            </>
          )}
          {business.verified && (
            <>
              <VerifiedBadge />
              <span aria-hidden className="text-white/50">
                ·
              </span>
            </>
          )}
          {business.establishedYear && (
            <>
              <span>Since {business.establishedYear}</span>
              <span aria-hidden className="text-white/50">
                ·
              </span>
            </>
          )}
          <span>{PRICE_TIER_LABELS[business.priceTier]}</span>
          <span aria-hidden className="text-white/50">
            ·
          </span>
          <span>{business.categoryName}</span>
          <span aria-hidden className="text-white/50">
            ·
          </span>
          <span>
            {business.areaName}, {business.cityName}
          </span>
          {business.brandId && business.branchCount && business.branchCount > 1 && (
            <>
              <span aria-hidden className="text-white/50">
                ·
              </span>
              <BranchSwitcher
                brandSlug={business.brandSlug!}
                brandName={business.brandName!}
                branchCount={business.branchCount}
                currentBusinessId={business.id}
              />
            </>
          )}
          {distance && (
            <>
              <span aria-hidden className="text-white/50">
                ·
              </span>
              <span>{distance}</span>
            </>
          )}
          {!distance && locationStatus !== "denied" && locationStatus !== "unavailable" && (
            <>
              <span aria-hidden className="text-white/50">
                ·
              </span>
              <button
                type="button"
                onClick={request}
                disabled={locationStatus === "asking"}
                className={cn("pointer-events-auto rounded underline decoration-white/50 hover:decoration-white disabled:opacity-60", focusRing)}
              >
                {locationStatus === "asking" ? "Locating…" : "Show distance from me"}
              </button>
            </>
          )}
        </div>

        {business.operatingHours && (
          <div className="mt-2 hidden sm:flex items-start gap-2 text-base sm:text-lg text-white/90 drop-shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="whitespace-pre-wrap">{business.operatingHours}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-screen ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] h-[420px] sm:h-[460px] md:h-[520px] lg:h-[580px] overflow-hidden bg-ink-900"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {photos.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-900 to-ink-800 text-ink-400">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L5 19" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-display text-sm text-ink-300">Photos coming soon</p>
        </div>
      )}

      {/* Single swipeable cinematic photo — the only view below lg, and the
          fallback at any width when there's just one photo (a strip needs 2+). */}
      {photos.length > 0 && (
        <div className={cn("relative h-full", stripPhotos.length > 1 && "lg:hidden")}>
          <GalleryImage src={photos[heroIndex]} alt={business.name} sizes="100vw" priority position="top" />
          <div className="absolute inset-0 pointer-events-none" style={HERO_GRADIENT} />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => shift(-1)}
                aria-label="Show previous photo"
                className={cn(
                  "absolute left-3 sm:left-6 top-[38%] sm:top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-ink-700 shadow-lift hover:bg-white",
                  interactiveTransition,
                  focusRing
                )}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => shift(1)}
                aria-label="Show next photo"
                className={cn(
                  "absolute right-3 sm:right-6 top-[38%] sm:top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-ink-700 shadow-lift hover:bg-white",
                  interactiveTransition,
                  focusRing
                )}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M8 15l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={photos.length === 1 ? openLightbox : openGrid}
            className="absolute top-4 right-3 sm:top-auto sm:bottom-9 sm:right-12 z-10 inline-flex items-center gap-2 rounded-full bg-black/55 px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L5 19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {photos.length === 1 ? "View photo" : `See all ${photos.length} photos`}
          </button>

          {/* pointer-events-none on this wrapper because it spans the full hero
              width and would otherwise swallow clicks meant for the "See all
              photos" button; only the actual interactive children opt back in. */}
          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-10 lg:px-16 xl:px-24 pb-6 sm:pb-10 lg:pb-14 pointer-events-none">
            {renderIdentity("text-3xl sm:text-5xl lg:text-6xl")}
          </div>
        </div>
      )}

      {/* Desktop (lg+) — Yelp-style photo strip: first 5 photos side by side,
          identity overlaid on the first (wider) tile, "See all N photos" on
          the last. Only shown when there are enough photos to make a strip. */}
      {stripPhotos.length > 1 && (
        <div className="hidden lg:flex h-full gap-0.5">
          {stripPhotos.map((url, i) => {
            const isFirst = i === 0;
            const isLast = i === stripPhotos.length - 1;
            return (
              <div key={url + i} className="relative h-full overflow-hidden" style={{ flex: isFirst ? 2 : 1 }}>
                <GalleryImage src={url} alt={business.name} sizes="40vw" priority={isFirst} position="top" />
                {isFirst ? (
                  <>
                    <div className="absolute inset-0 pointer-events-none" style={HERO_GRADIENT} />
                    <div className="absolute inset-x-0 bottom-0 px-6 xl:px-8 pb-8 pointer-events-none">
                      {renderIdentity("text-3xl xl:text-4xl")}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => (isLast ? openGrid() : openPhotoAt(i))}
                    aria-label={isLast ? `See all ${photos.length} photos` : `View photo ${i + 1} of ${business.name}`}
                    className="absolute inset-0"
                  >
                    {isLast && (
                      <div className="absolute inset-0 flex items-end justify-center bg-black/35 pb-6 transition-colors hover:bg-black/50">
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <circle cx="9" cy="11" r="2" />
                            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L5 19" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          See all {photos.length} photos
                        </span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PhotoGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={photos}
        businessName={business.name}
        initialIndex={lightboxIndex}
      />
    </div>
  );
}