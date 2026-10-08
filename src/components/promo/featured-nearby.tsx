"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { promoApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useUserLocation } from "@/lib/location-context";
import { hiddenAds, hideAd, rememberAttribution, trackPromo } from "@/lib/promo-session";
import type { PromoSource, SponsoredBusiness } from "@/lib/types";
import { cn, focusRing } from "@/lib/utils";
import { BusinessCard } from "../business-card";
import { CAROUSEL_ITEM_WIDTH, CarouselStrip } from "../business-carousel";
import { SponsoredLabel } from "./business-post-card";
import { useImpression } from "./use-impression";

/** One sponsored business card: "Sponsored" label, why/hide controls, impression + click tracking. */
export function SponsoredBusinessCard({
  item,
  source,
  onHidden,
  className,
}: {
  item: SponsoredBusiness;
  source: PromoSource;
  onHidden: () => void;
  className?: string;
}) {
  const { t } = useLanguage();
  const [why, setWhy] = useState(false);
  const ref = useImpression<HTMLDivElement>(() => trackPromo("IMPRESSION", { postId: item.postId, boostId: item.boostId, source }));
  const refTag = source === "SEARCH" ? "search" : "home";
  return (
    <div ref={ref} className={cn("relative flex flex-col", className)}>
      <div
        className="flex-1"
        onClickCapture={() => {
          rememberAttribution({ businessId: item.business.id, postId: item.postId, boostId: item.boostId, ref: refTag, source });
          trackPromo("CLICK", { postId: item.postId, boostId: item.boostId, source, ref: refTag });
        }}
      >
        <BusinessCard business={item.business} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <SponsoredLabel />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("promo.why_this_ad")}
            aria-expanded={why}
            onClick={() => setWhy((v) => !v)}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100", focusRing)}
          >
            <Info size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              hideAd(item.boostId);
              onHidden();
            }}
            className={cn("min-h-9 rounded-full px-2 text-xs font-medium text-ink-500 hover:bg-ink-100", focusRing)}
          >
            {t("promo.hide_ad")}
          </button>
        </div>
      </div>
      {why && <p className="px-1 text-xs text-ink-500">{item.why} {t("promo.why_note")}</p>}
    </div>
  );
}

/**
 * Home "Featured nearby" (V58): up to 6 boosted businesses targeting where the visitor is — only
 * the location they already granted, else city-level. Renders nothing when no boost is eligible or
 * the admin turned the placement off. Always labelled "Sponsored"; organic sections are untouched.
 */
export function FeaturedNearby() {
  const { t } = useLanguage();
  const { status, coords } = useUserLocation();
  const [items, setItems] = useState<SponsoredBusiness[]>([]);
  const lat = status === "granted" && coords ? Math.round(coords.lat * 1000) / 1000 : undefined;
  const lng = status === "granted" && coords ? Math.round(coords.lng * 1000) / 1000 : undefined;

  useEffect(() => {
    promoApi
      .featuredNearby({ lat, lng })
      .then((list) => {
        const hidden = hiddenAds();
        setItems(list.filter((i) => !hidden.has(i.boostId)));
      })
      .catch(() => setItems([]));
  }, [lat, lng]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="featured-nearby-heading">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="featured-nearby-heading" className="font-display text-lg font-bold text-ink-900">
          {t("promo.featured_nearby")}
        </h2>
        <SponsoredLabel />
      </div>
      <CarouselStrip bleed>
        {items.map((item) => (
          <SponsoredBusinessCard
            key={item.boostId}
            item={item}
            source="HOME"
            className={cn("shrink-0 snap-start", CAROUSEL_ITEM_WIDTH)}
            onHidden={() => setItems((prev) => prev.filter((x) => x.boostId !== item.boostId))}
          />
        ))}
      </CarouselStrip>
    </section>
  );
}
