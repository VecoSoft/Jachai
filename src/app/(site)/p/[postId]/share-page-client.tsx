"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CalendarDays, ExternalLink, ShoppingBag, Store, Tag } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { rememberAttribution, trackPromo } from "@/lib/promo-session";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import type { PromoSharePayload, PromoSource } from "@/lib/types";
import { BusinessCard } from "@/components/business-card";
import { CommunityMarkdown } from "@/components/community-markdown";
import { BusinessPill } from "@/components/promo/business-post-card";
import { FluidCreativePreview } from "@/components/promo/creative-preview";
import { ShareBar } from "@/components/promo/share-bar";

const REF = /^(share|wa|fb|qr|promo_[0-9a-f-]{36})$/i;

function sourceFor(ref: string): PromoSource {
  return ref === "share" || ref === "wa" || ref === "fb" ? "SHARE_LINK" : "EXTERNAL";
}

function Inner({ share }: { share: PromoSharePayload }) {
  const { t, lang } = useLanguage();
  const params = useSearchParams();
  const { post, business, creative } = share;
  const promo = post.promotion ?? null;
  const expired = Boolean(promo?.expired);
  const rawRef = params.get("ref") ?? "share";
  const ref = REF.test(rawRef) ? rawRef.toLowerCase() : "share";
  const landed = useRef(false);

  // Landing from a shared link: remember it (so a claim/order here is credited) and count the visit once.
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    const source = sourceFor(ref);
    rememberAttribution({ businessId: business.id, postId: post.id, boostId: null, offerId: promo?.offer?.id ?? null, ref, source });
    trackPromo("CLICK", { postId: post.id, boostId: null, source, ref });
  }, [business.id, post.id, promo?.offer?.id, ref]);

  const cta =
    promo?.cta === "GET_OFFER" && promo.offer ? (
      expired ? null : (
        <Link href={`/community/offers/${promo.offer.id}`} className={ctaClass}>
          <Tag size={16} /> {t("promo.get_offer")}
        </Link>
      )
    ) : promo?.cta === "ORDER" && promo.menuItem ? (
      <Link href={`/business/${business.slug}?item=${promo.menuItem.id}`} className={ctaClass}>
        <ShoppingBag size={16} /> {t("promo.order")}
      </Link>
    ) : (
      <Link href={`/business/${business.slug}`} className={ctaClass}>
        <Store size={16} /> {t("promo.view_business")}
      </Link>
    );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-ink-900">{business.name}</span>
        {business.verified && <BadgeCheck size={15} className="text-brand-600" />}
        <BusinessPill />
      </div>

      <div className="relative">
        {creative ? (
          <FluidCreativePreview model={{ ...creative, expired: creative.expired || expired }} showExpired />
        ) : promo?.squareUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.squareUrl} alt="" className="w-full rounded-xl" />
        ) : null}
        {expired && (
          <p className="mt-2 rounded-lg bg-ink-100 px-3 py-2 text-center text-sm font-semibold text-ink-700">
            {t("promo.share_page.expired")}
          </p>
        )}
      </div>

      {post.body && <CommunityMarkdown className="text-base text-ink-800">{post.body}</CommunityMarkdown>}

      {promo?.type === "EVENT" && promo.eventStart && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-sm">
          <CalendarDays size={15} />
          {new Date(promo.eventStart).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {cta}
        <Link href={`/community/${post.id}`} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-200 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50", focusRing, interactiveTransition)}>
          <ExternalLink size={16} /> {t("promo.share_page.open_in_jachai")}
        </Link>
      </div>

      <ShareBar postId={post.id} text={post.body ?? business.name} />

      <div className="max-w-xs">
        <BusinessCard business={business} />
      </div>
    </div>
  );
}

const ctaClass = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-crimson-600 px-5 text-sm font-semibold text-white hover:bg-crimson-700",
  focusRing,
  interactiveTransition
);

export function SharePageClient({ share }: { share: PromoSharePayload }) {
  return (
    <Suspense fallback={null}>
      <Inner share={share} />
    </Suspense>
  );
}
