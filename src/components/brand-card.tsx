"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import type { BusinessResponse } from "@/lib/types";
import { formatReviewCount } from "@/lib/utils";
import { RatingBoxes } from "./rating-boxes";
import { Card } from "./ui/misc";

/**
 * Grouped search-result card for a chain — "KFC — 5 branches" instead of N separate
 * <BusinessCard/> tiles. A sibling to BusinessCard, not a variant of it: BusinessCard's
 * reaction bar/bookmark/share are all keyed to one concrete business.id, which a brand
 * grouping doesn't have. Modeled on SimilarBusinessCard's lighter, single-Link-wrapped
 * card, but sized as a full grid tile since it sits in the same search results grid as
 * BusinessCard. Links to the representative (top-ranked) branch — there's no separate
 * /brand/{slug} landing page in v1; that branch's page has the branch switcher.
 */
export function BrandCard({ business }: { business: BusinessResponse }) {
  const { t, tn } = useLanguage();
  const photo = business.photoUrls[0] ?? business.coverPhotoUrl ?? null;
  const rating = business.brandAverageRating ?? business.averageRating;

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-xl border border-ink-100 bg-white transition-shadow duration-200 hover:shadow-lift">
      <Link href={`/business/${business.slug}`} className="flex grow flex-col">
        <div className="relative h-48 w-full flex-none overflow-hidden rounded-t-xl bg-ink-100">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={business.brandName ?? business.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-ink-900 to-ink-800 text-ink-400">
              <StoreIcon />
              <span className="px-1 text-center font-display text-xs text-ink-300">{business.categoryName}</span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5 pr-12">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-800 shadow-sm">
              {business.categoryName}
            </span>
            {business.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                {t("common.verified")}
              </span>
            )}
          </div>

          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-crimson-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <StoreIcon small />
            {tn("brand_card.branch_count", business.branchCount ?? 0)}
          </span>
        </div>

        <div className="p-4 pb-0">
          <h3 className="font-display text-lg font-bold leading-snug text-ink-900">
            {business.brandName ?? business.name}
          </h3>

          <div className="mt-2 flex items-center gap-2">
            <RatingBoxes rating={rating} size="sm" />
            <span className="text-base font-bold text-ink-900">{rating.toFixed(1)}</span>
            <span className="text-sm text-ink-400">
              ({tn("business_card.rating_count", business.reviewCount, { n: formatReviewCount(business.reviewCount) })})
            </span>
          </div>
        </div>
      </Link>

      <div className="px-4 pb-4">
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-gold-50 px-3 py-1.5 text-xs font-medium text-gold-700">
            <PinIcon />
            <span className="truncate">
              {business.areaName}, {business.cityName}
            </span>
          </span>
          <Link
            href={`/business/${business.slug}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-800"
          >
            {t("common.view_details")}
            <ArrowUpRightIcon />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function StoreIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-3 w-3" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0V9a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
