"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, EyeOff, Flag, Info, MoreHorizontal, ShoppingBag, Store, Tag } from "lucide-react";
import { communityApi, promoApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useLanguage } from "@/lib/language-context";
import { hideAd, rememberAttribution, trackPromo } from "@/lib/promo-session";
import { errorMessage, useToast } from "@/lib/toast-context";
import { applyVoteDelta } from "@/lib/community-vote";
import { cn, focusRing, interactiveTransition, timeAgo } from "@/lib/utils";
import type { CommunityPostResponse, CommunityPostVoteType, PromoSource } from "@/lib/types";
import { CommunityMarkdown } from "../community-markdown";
import { PendingReviewNote, RemovedPostPlaceholder } from "../community-moderation";
import { PostActions } from "../community-post-actions";
import { ReportButton } from "../report-button";
import { VoteControls } from "../vote-controls";
import { Button } from "../ui/button";
import { useImpression } from "./use-impression";

/** Business logo — square-rounded, never a circle, so business posts never pass for member posts. */
export function BusinessAvatar({ name, logoUrl, size = 36 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-lg object-cover ring-1 ring-ink-100" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-crimson-700 text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "B"}
    </span>
  );
}

/** "Business" pill — neutral ink, deliberately not the brand crimson. */
export function BusinessPill() {
  const { t } = useLanguage();
  return (
    <span className="rounded-full border border-ink-200 bg-ink-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-600">
      {t("promo.business")}
    </span>
  );
}

export function SponsoredLabel() {
  const { t } = useLanguage();
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{t("promo.sponsored")}</span>;
}

/** ⋯ menu on every sponsored item: Hide this ad · Why am I seeing this? · Report. */
function SponsoredMenu({ post, onHidden }: { post: CommunityPostResponse; onHidden: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = cn(
    "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50",
    focusRing
  );

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={t("promo.ad_options")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100", focusRing)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-ink-100 bg-surface p-1 shadow-pop">
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              if (post.sponsored) hideAd(post.sponsored.boostId);
              setOpen(false);
              onHidden();
            }}
          >
            <EyeOff size={16} /> {t("promo.hide_ad")}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => setWhy((v) => !v)}>
            <Info size={16} /> {t("promo.why_this_ad")}
          </button>
          {why && post.sponsored && (
            <p className="px-2.5 pb-2 text-xs leading-relaxed text-ink-500">
              {post.sponsored.why} {t("promo.why_note")}
            </p>
          )}
          <ReportButton
            targetType="COMMUNITY_POST"
            targetId={post.id}
            trigger={(openModal) => (
              <button type="button" role="menuitem" className={cn(item, "text-rose-600 dark:text-rose-400")} onClick={openModal}>
                <Flag size={16} /> {t("promo.report_ad")}
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}

function formatEvent(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A post published AS a business (V58) — the business identity (square logo, name, verified check,
 * "Business" pill), the creative, and a CTA that depends on the post type. A paid placement shows
 * "Sponsored" in place of the pill plus the ad menu. Votes, comments and share work like any post.
 */
export function BusinessPostCard({
  post,
  onChanged,
  onDeleted,
  source = "FEED",
  detail = false,
}: {
  post: CommunityPostResponse;
  onChanged: (post: CommunityPostResponse) => void;
  onDeleted: (postId: string) => void;
  source?: PromoSource;
  /** Post detail page: full body, no card-level navigation, no local "hide". */
  detail?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { show } = useToast();
  const { t, lang } = useLanguage();
  const business = post.business!;
  const promo = post.promotion ?? null;
  const sponsored = post.sponsored ?? null;
  const boostId = sponsored?.boostId ?? null;
  const [interestBusy, setInterestBusy] = useState(false);
  const ref = post.sponsored ? "feed" : source === "SHARE_LINK" ? "share" : "feed";

  const impressionRef = useImpression<HTMLDivElement>(
    () => trackPromo("IMPRESSION", { postId: post.id, boostId, source }),
    post.status === "ACTIVE"
  );

  function remember() {
    rememberAttribution({ businessId: business.id, postId: post.id, boostId, offerId: promo?.offer?.id ?? null, ref, source });
  }

  function click() {
    remember();
    trackPromo("CLICK", { postId: post.id, boostId, source, ref });
  }

  async function handleVote(type: CommunityPostVoteType) {
    await communityApi.vote(post.id, type);
    onChanged(applyVoteDelta(post, type));
  }

  async function toggleInterested() {
    if (!user) {
      openLogin();
      return;
    }
    click();
    setInterestBusy(true);
    try {
      const res = await promoApi.interested(post.id);
      if (promo) onChanged({ ...post, promotion: { ...promo, interestedCount: res.interestedCount, interested: !promo.interested } });
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setInterestBusy(false);
    }
  }

  const expired = Boolean(promo?.expired);
  const ctaClass = "min-h-11 rounded-full px-4 text-sm";
  let cta: React.ReactNode = null;
  if (promo && post.status !== "REMOVED") {
    if (promo.cta === "GET_OFFER" && promo.offer) {
      cta = expired ? (
        <Button className={ctaClass} disabled>
          <Tag size={15} /> {t("promo.offer_ended")}
        </Button>
      ) : (
        <Link href={`/community/offers/${promo.offer.id}`} onClick={click} className={cn("inline-flex items-center gap-1.5 bg-crimson-600 font-semibold text-white hover:bg-crimson-700", ctaClass, focusRing, interactiveTransition)}>
          <Tag size={15} /> {t("promo.get_offer")}
        </Link>
      );
    } else if (promo.cta === "ORDER" && promo.menuItem) {
      cta = expired ? (
        <Button className={ctaClass} disabled>
          <ShoppingBag size={15} /> {t("promo.order")}
        </Button>
      ) : (
        <Link href={`/business/${business.slug}?item=${promo.menuItem.id}`} onClick={click} className={cn("inline-flex items-center gap-1.5 bg-crimson-600 font-semibold text-white hover:bg-crimson-700", ctaClass, focusRing, interactiveTransition)}>
          <ShoppingBag size={15} /> {t("promo.order")}
        </Link>
      );
    } else if (promo.cta === "INTERESTED") {
      cta = (
        <Button
          variant={promo.interested ? "primary" : "outline"}
          className={ctaClass}
          disabled={expired || interestBusy}
          aria-pressed={promo.interested}
          onClick={toggleInterested}
        >
          {t("promo.interested")} · {promo.interestedCount}
        </Button>
      );
    } else {
      cta = (
        <Link href={`/business/${business.slug}`} onClick={click} className={cn("inline-flex items-center gap-1.5 border border-ink-200 font-semibold text-ink-800 hover:bg-ink-50", ctaClass, focusRing, interactiveTransition)}>
          <Store size={15} /> {t("promo.view_business")}
        </Link>
      );
    }
  }

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <Link href={`/business/${business.slug}`} onClick={(e) => { e.stopPropagation(); click(); }} className={cn("rounded-lg", focusRing)}>
          <BusinessAvatar name={business.name} logoUrl={business.logoUrl} size={36} />
        </Link>
        <div className="min-w-0 leading-tight">
          <p className="flex flex-wrap items-center gap-1 text-[13px]">
            <Link
              href={`/business/${business.slug}`}
              onClick={(e) => { e.stopPropagation(); click(); }}
              className={cn("min-w-0 truncate font-semibold text-ink-800 hover:underline", focusRing)}
            >
              {business.name}
            </Link>
            {business.verified && <BadgeCheck size={13} className="shrink-0 text-brand-600" aria-label={t("common.verified")} />}
            {sponsored ? <SponsoredLabel /> : <BusinessPill />}
          </p>
          <p className="text-xs text-ink-500">
            {[business.areaName ?? post.area?.name, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {sponsored && !detail && <SponsoredMenu post={post} onHidden={() => onDeleted(post.id)} />}
    </div>
  );

  const postHref = `/community/${post.id}`;
  const clickable = !detail;

  return (
    <div
      ref={impressionRef}
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => { click(); router.push(postHref); } : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") { click(); router.push(postHref); } } : undefined}
      className={cn(
        "flex flex-col gap-2 py-5",
        clickable && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson-500",
        sponsored && "rounded-2xl bg-ink-50/60 px-3"
      )}
    >
      {header}

      {post.status === "REMOVED" && <RemovedPostPlaceholder post={post} />}
      {(post.status === "PENDING" || post.status === "HIDDEN") && <PendingReviewNote />}
      {post.status === "DRAFT" && <p className="text-xs font-medium text-ink-500">{t("promo.draft")}</p>}
      {promo?.rejectionReason && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {t("promo.rejected")}: {promo.rejectionReason}
        </p>
      )}

      {post.title && <h3 className="font-display text-[15px] font-bold leading-snug text-ink-900">{post.title}</h3>}
      {post.body && (
        <CommunityMarkdown className={cn("text-[15px] text-ink-800", !detail && "line-clamp-4 overflow-hidden")}>
          {post.body}
        </CommunityMarkdown>
      )}

      {promo?.squareUrl && (
        // Feed: the wide (1200×630) render on tablet/desktop so a promo takes about as much room as
        // a normal post; phones keep the square, which already fits the screen. The post page
        // shows the square, capped so it never dominates the page.
        <div className={cn("relative overflow-hidden rounded-xl border border-ink-100", detail && "mx-auto w-full max-w-md")}>
          <picture>
            {!detail && promo.ogUrl && <source media="(min-width: 640px)" srcSet={promo.ogUrl} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promo.squareUrl}
              alt={post.title ?? business.name}
              className={cn("block aspect-square w-full object-cover", !detail && promo.ogUrl && "sm:aspect-[1200/630]")}
              loading="lazy"
            />
          </picture>
          {expired && (
            <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {t("promo.expired")}
            </span>
          )}
        </div>
      )}
      {!promo?.squareUrl && expired && (
        <span className="w-fit rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-ink-600">
          {t("promo.expired")}
        </span>
      )}

      {promo?.type === "EVENT" && promo.eventStart && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-700">
          <CalendarDays size={13} /> {formatEvent(promo.eventStart, lang)}
        </span>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <VoteControls score={post.score} upvoteCount={post.upvoteCount} myVote={post.myVote} onVote={handleVote} size="sm" orientation="horizontal" />
          <PostActions
            commentCount={post.commentCount}
            shareUrl={`/p/${post.id}`}
            shareTitle={post.title ?? business.name}
            onCommentClick={detail ? undefined : () => router.push(postHref)}
          />
        </div>
        {cta}
      </div>
    </div>
  );
}
