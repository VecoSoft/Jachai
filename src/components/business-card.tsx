"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Check, MapPin, Star } from "lucide-react";
import { priceTierLabel, priceTierSymbols } from "@/lib/config";
import { categoryIcon } from "@/lib/category-icons";
import { getOpenStatus, type OpenStatus } from "@/lib/business-hours";
import { offerDiscountLabel } from "@/lib/offer-constants";
import { useLanguage } from "@/lib/language-context";
import { useUserLocation } from "@/lib/location-context";
import type { BusinessCardData } from "@/lib/types";
import { cn, distanceKm, focusRing, formatDistance, formatReviewCount, interactiveTransition } from "@/lib/utils";
import { BookmarkButton } from "./bookmark-button";
import { RatingBoxes } from "./rating-boxes";

type Variant = "grid" | "list";
type Translate = (key: string, params?: Record<string, string | number>) => string;

const GRID_IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw";
const NEW_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

function openLabelFor(status: OpenStatus | null, t: Translate): string | null {
  if (!status) return null;
  if (status.open) return t("business_card.open");
  return status.changesAt ? t("business_card.closed_opens", { time: status.changesAt }) : t("business_card.closed");
}

/** The one overlay badge, by priority: active offer > "New" (< 14 days old) > none. Both
 *  share the same slot/style — never two badges on the same card. */
function badgeLabelFor(business: BusinessCardData, t: Translate): string | null {
  if (business.activeOffer) return offerDiscountLabel(business.activeOffer);
  const age = Date.now() - new Date(business.createdAt).getTime();
  if (age >= 0 && age < NEW_THRESHOLD_MS) return t("business_card.new");
  return null;
}

/** Photo, or a clean category-icon + initial placeholder — used both when there's no photo
 *  and when the photo fails to load, so a card never shows a broken-image icon. */
function CardPhoto({ business, sizes, className }: { business: BusinessCardData; sizes?: string; className?: string }) {
  const photo = business.photoUrls[0] ?? null;
  const CategoryIcon = categoryIcon(business.categoryName);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-ink-100 dark:bg-ink-800", className)}>
      {photo && !failed ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes={sizes ?? "96px"}
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-ink-50 dark:bg-ink-800">
          <CategoryIcon size={32} strokeWidth={1.5} className="text-ink-300 dark:text-ink-600" />
          <span className="font-display text-lg font-bold text-ink-300 dark:text-ink-600">
            {business.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

function CardBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("rounded-md bg-crimson-600 px-1.5 py-0.5 text-[11px] font-semibold text-white", className)}>
      {label}
    </span>
  );
}

/** "★ 4.0 · 21 reviews" — or "New · no reviews yet" when nobody's reviewed it yet, never
 *  "0.0 (0)". One small line in both cases, so it never wraps or gets cut off in a narrow card. */
function RatingLine({ business }: { business: BusinessCardData }) {
  const { t, tn } = useLanguage();
  if (business.reviewCount === 0) {
    return <p className="truncate text-[13px] text-ink-500">{t("business_card.new_no_reviews")}</p>;
  }
  return (
    <p className="flex min-w-0 items-center gap-1 text-[13px] text-ink-500">
      <Star aria-hidden size={13} className="shrink-0 fill-crimson-600 text-crimson-600" />
      <span className="font-semibold text-ink-800">{business.averageRating.toFixed(1)}</span>
      <span aria-hidden>·</span>
      <span className="truncate tabular-nums">
        {tn("business_card.review_count", business.reviewCount, { n: formatReviewCount(business.reviewCount) })}
      </span>
    </p>
  );
}

/** "● Open · 1.2 km" — either half can be absent (no structured hours; location not
 *  granted), and the whole row disappears rather than showing an empty separator. */
function StatusLine({ business, distance }: { business: BusinessCardData; distance: string | null }) {
  const { t } = useLanguage();
  const openStatus = getOpenStatus(business.structuredHours, business.hoursExceptions);
  const openLabel = openLabelFor(openStatus, t);

  if (!openLabel && !distance) return null;

  return (
    <p className="flex items-center gap-1 truncate text-[13px]">
      {openLabel && (
        <span className={cn("inline-flex items-center gap-1", openStatus?.open ? "text-brand-600" : "text-ink-500")}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {openLabel}
        </span>
      )}
      {openLabel && distance && (
        <span aria-hidden className="text-ink-300">
          ·
        </span>
      )}
      {distance && (
        <span className="inline-flex items-center gap-0.5 tabular-nums text-ink-500">
          <MapPin size={12} />
          {distance}
        </span>
      )}
    </p>
  );
}

/** List variant's third line — open status, distance and area all on one dense row
 *  (unlike the grid, which gives the area its own line below). Either of the first two
 *  can be absent; area always shows. */
function StatusAreaLine({ business, distance }: { business: BusinessCardData; distance: string | null }) {
  const { t } = useLanguage();
  const openStatus = getOpenStatus(business.structuredHours, business.hoursExceptions);
  const openLabel = openLabelFor(openStatus, t);

  return (
    <p className="flex items-center gap-1 truncate text-[13px] text-ink-500">
      {openLabel && (
        <>
          <span className={cn("inline-flex items-center gap-1", openStatus?.open ? "text-brand-600" : "text-ink-500")}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {openLabel}
          </span>
          <span aria-hidden className="text-ink-300">
            ·
          </span>
        </>
      )}
      {distance && (
        <>
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <MapPin size={12} />
            {distance}
          </span>
          <span aria-hidden className="text-ink-300">
            ·
          </span>
        </>
      )}
      <span className="truncate">
        {business.areaName}, {business.cityName}
      </span>
    </p>
  );
}

/** Name with the Verified tick glued to its last word, so the tick never wraps onto a line by itself. */
function NameWithMark({ name, verified }: { name: string; verified: boolean }) {
  if (!verified) return <>{name}</>;
  const cut = name.trimEnd().lastIndexOf(" ");
  const head = cut >= 0 ? name.slice(0, cut + 1) : "";
  const last = cut >= 0 ? name.slice(cut + 1) : name;
  return (
    <>
      {head}
      <span className="whitespace-nowrap">
        {last}
        <VerifiedMark />
      </span>
    </>
  );
}

function VerifiedMark() {
  return (
    <BadgeCheck
      size={14}
      role="img"
      aria-label="Verified business"
      className="ml-1 inline-block shrink-0 align-text-bottom text-brand-600"
    />
  );
}

/** Search results only: why this card matched ("Menu: Chicken Biryani · 4.1 km from Mirpur"). */
export function MatchReasons({ reasons, className }: { reasons?: string[]; className?: string }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <p className={cn("flex items-center gap-1 truncate text-xs font-medium text-emerald-700 dark:text-emerald-400", className)}>
      <Check aria-hidden size={13} strokeWidth={2.5} className="shrink-0" />
      <span className="truncate">{reasons.join(" · ")}</span>
    </p>
  );
}

function CardMeta({
  business,
  distance,
  matchReasons,
}: {
  business: BusinessCardData;
  distance: string | null;
  matchReasons?: string[];
}) {
  return (
    <>
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900">
        <NameWithMark name={business.name} verified={business.verified} />
      </h3>
      <RatingLine business={business} />
      <p className="truncate text-[13px] text-ink-500">
        {business.categoryName}
        {priceTierSymbols(business.priceTier) && <> · {priceTierSymbols(business.priceTier)}</>}
      </p>
      <StatusLine business={business} distance={distance} />
      <p className="truncate text-[13px] text-ink-500">
        {business.areaName}, {business.cityName}
      </p>
      <MatchReasons reasons={matchReasons} />
      {business.activeOffer && <p className="truncate text-xs font-medium text-crimson-600">{business.activeOffer.title}</p>}
    </>
  );
}

/** List variant's rating row also carries category · price on the same line (denser
 *  than the grid's separate line) — see spec section 3's anatomy. */
function RatingLineWithMeta({ business }: { business: BusinessCardData }) {
  const { t, tn, lang } = useLanguage();
  const priceLabel = priceTierLabel(business.priceTier, lang);
  if (business.reviewCount === 0) {
    return (
      <p className="truncate text-[13px] text-ink-500">
        {t("business_card.new_no_reviews")} · {business.categoryName} · {priceLabel}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-1.5 truncate text-[13px]">
      <RatingBoxes rating={business.averageRating} size="md" />
      <span className="font-semibold text-ink-900 dark:text-ink-100">{business.averageRating.toFixed(1)}</span>
      <span className="tabular-nums text-ink-500">
        ({tn("business_card.review_count", business.reviewCount, { n: formatReviewCount(business.reviewCount) })})
      </span>
      <span className="text-ink-500">
        · {business.categoryName} · {priceLabel}
      </span>
    </div>
  );
}

/** srLabel's own reviews phrase isn't run through i18n (aria-label text follows this
 *  codebase's existing convention — e.g. ChatHeader, PostMenu — of staying plain English
 *  regardless of `lang`, unlike the visible text above). */
function reviewsPhraseFor(business: BusinessCardData): string {
  if (business.reviewCount === 0) return "new, no reviews yet";
  return `rated ${business.averageRating.toFixed(1)} from ${business.reviewCount} review${business.reviewCount === 1 ? "" : "s"}`;
}

/**
 * The one business card for every surface in the app (home Trending/Most-loved/Browse,
 * Similar businesses, Saved/Bookmarks) — carousels and the Browse grid use the same
 * vertical "grid" tile; list is a horizontal row for a denser single column. Distance is self-sourced from
 * the shared LocationProvider (see lib/location-context.tsx), not a prop, so granting
 * location anywhere makes it show up on every card everywhere with no plumbing.
 */
export function BusinessCard({
  business,
  variant = "grid",
  className,
  matchReasons,
}: {
  business: BusinessCardData;
  variant?: Variant;
  className?: string;
  /** Smart-search results only — short "why this matched" labels from the API. */
  matchReasons?: string[];
}) {
  const { t } = useLanguage();
  const { status: locationStatus, coords } = useUserLocation();
  const distance =
    locationStatus === "granted" && coords && business.latitude != null && business.longitude != null
      ? formatDistance(distanceKm(coords, { lat: business.latitude, lng: business.longitude }))
      : null;
  const badgeLabel = badgeLabelFor(business, t);

  const href = `/business/${business.slug}`;
  const srLabel = [
    business.name,
    reviewsPhraseFor(business),
    business.categoryName,
    `${business.areaName}, ${business.cityName}`,
    distance ? `${distance} away` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const cardClasses = cn(
    "group rounded-xl border border-ink-100 bg-surface dark:border-ink-800 dark:bg-ink-900",
    interactiveTransition,
    focusRing,
    "hover:shadow-md active:scale-[0.99]"
  );

  if (variant === "list") {
    return (
      <Link href={href} aria-label={srLabel} className={cn(cardClasses, "flex gap-3 overflow-hidden p-3", className)}>
        <CardPhoto business={business} sizes="96px" className="size-24 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug text-ink-900">
              <NameWithMark name={business.name} verified={business.verified} />
            </h3>
            {badgeLabel && <CardBadge label={badgeLabel} className="shrink-0" />}
          </div>
          <RatingLineWithMeta business={business} />
          <StatusAreaLine business={business} distance={distance} />
          <MatchReasons reasons={matchReasons} />
          {business.topReviewSnippet && (
            <p className="line-clamp-1 text-xs italic text-ink-500">&ldquo;{business.topReviewSnippet}&rdquo;</p>
          )}
        </div>
      </Link>
    );
  }

  // The grid tile — also what every homepage carousel renders (BusinessCarousel sizes each
  // card to exactly one Browse grid column, so the two look identical).
  return (
    <Link href={href} aria-label={srLabel} className={cn(cardClasses, "relative flex h-full flex-col overflow-hidden", className)}>
      <CardPhoto business={business} sizes={GRID_IMAGE_SIZES} className="aspect-square md:aspect-[4/3]" />
      {badgeLabel && <CardBadge label={badgeLabel} className="absolute left-2 top-2" />}
      <div className="absolute right-2 top-2">
        <BookmarkButton businessId={business.id} businessName={business.name} iconOnly />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <CardMeta business={business} distance={distance} matchReasons={matchReasons} />
      </div>
    </Link>
  );
}
