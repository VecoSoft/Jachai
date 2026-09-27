"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Flag, MoreHorizontal, Share2 } from "lucide-react";
import { businessApi, referenceApi, reviewApi } from "@/lib/api";
import { rememberBusiness } from "@/lib/business-cache";
import { REPORT_REASON_LABELS } from "@/lib/config";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import type { BusinessResponse, ReviewResponse, ReviewSortOption } from "@/lib/types";
import { modulesForKind, moduleHasData, type ModuleKey } from "@/lib/category-modules";
import { canBook, canSellDirect } from "@/lib/commerce";
import { trackEvent, trackProfileView } from "@/lib/analytics";
import { RatingBoxes } from "@/components/rating-boxes";
import { VerifiedBadge } from "@/components/verified-badge";
import { MapPreview } from "@/components/map-preview";
import { ShareButton } from "@/components/share-button";
import { BusinessActions } from "@/components/business-actions";
import { BusinessReactionBar } from "@/components/business-reaction-bar";
import { ClaimBusinessModal } from "@/components/claim-business-modal";
import { CreateBusinessAccountModal } from "@/components/create-business-account-modal";
import { ReportButton } from "@/components/report-button";
import { IconButton } from "@/components/ui/icon-button";
import { BusinessMessageSidebarCard, BusinessMessageWidget, type MessageWidgetState } from "@/components/business-message-widget";
import { BusinessCarousel } from "@/components/business-carousel";
import { BusinessHeroGallery } from "@/components/business-hero-gallery";
import { OfferBusinessBanner } from "@/components/offer-business-banner";
import { BusinessTabs, type BusinessTab } from "@/components/business-tabs";
import { BusinessAbout } from "@/components/business-about";
import { BusinessFaq } from "@/components/business-faq";
import { BusinessUpdates } from "@/components/business-updates";
import { BusinessMenu } from "@/components/business-menu";
import { CartBar } from "@/components/cart-bar";
import { BusinessServiceShowcase } from "@/components/business-service-showcase";
import { BusinessTeam } from "@/components/business-team";
import { BusinessProducts } from "@/components/business-products";
import { PhotoGalleryModal } from "@/components/photo-gallery-modal";
import { GalleryImage } from "@/components/gallery-image";
import { ReviewCard } from "@/components/review-card";
import { ReviewForm } from "@/components/review-form";
import { RatingBreakdownChart } from "@/components/rating-breakdown-chart";
import { EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

/** Header overflow menu — Share and Report are occasional actions, not primary
 *  ones, so they live behind ⋯ rather than as their own always-visible buttons. */
function BusinessHeaderMenu({ business }: { business: BusinessResponse }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass = cn(
    "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800",
    focusRing
  );
  // A separate string, not itemClass + a color override — cn() has no tailwind-merge,
  // so itemClass's own `text-ink-700` would otherwise sit in the DOM alongside this
  // one's `text-rose-600` with no reliable winner (see lib/utils.ts#focusRing).
  const itemClassDanger = cn(
    "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 dark:text-rose-400",
    focusRing
  );

  return (
    <div ref={containerRef} className="relative shrink-0">
      <IconButton variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-label="More options" aria-haspopup="menu" aria-expanded={open}>
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </IconButton>
      <div
        role="menu"
        className={cn(
          "absolute right-0 top-full z-20 mt-1 w-44 origin-top-right rounded-lg border border-ink-100 bg-surface p-1 shadow-pop dark:border-ink-700",
          open ? "block animate-scale-in" : "hidden"
        )}
      >
        <ShareButton
          url={`/business/${business.slug}`}
          title={business.name}
          trigger={(onClick) => (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                setOpen(false);
                onClick(e);
              }}
              className={itemClass}
            >
              <Share2 size={15} />
              Share
            </button>
          )}
        />
        <div className="my-1 border-t border-ink-100 dark:border-ink-700" />
        <ReportButton
          targetType="LISTING"
          targetId={business.id}
          trigger={(openModal) => (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openModal();
              }}
              className={itemClassDanger}
            >
              <Flag size={15} />
              Report
            </button>
          )}
        />
      </div>
    </div>
  );
}

export default function BusinessDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, switchAccount } = useAuth();
  const { openLogin, openSignup } = useAuthModal();
  const { show } = useToast();

  const [business, setBusiness] = useState<BusinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(0);
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>("newest");
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsAuthRequired, setReviewsAuthRequired] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewResponse | null>(null);
  const [myReview, setMyReview] = useState<ReviewResponse | null>(null);

  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [createBizModalOpen, setCreateBizModalOpen] = useState(false);
  const [messageWidgetState, setMessageWidgetState] = useState<MessageWidgetState>("closed");
  const [switchingForClaim, setSwitchingForClaim] = useState(false);

  // Section nav (spec: Reviews default, tabs only shown when the business has
  // data for them). Panels stay mounted and toggle via `hidden` so the
  // #reviews anchor / scroll-into-view keep working from the hero.
  const [activeTab, setActiveTab] = useState<string>("reviews");
  const [photosModalOpen, setPhotosModalOpen] = useState(false);
  const [photosModalIndex, setPhotosModalIndex] = useState<number | null>(null);
  /** Deep-linked from e.g. an offer's "Order Now" (`?item=<menuItemId>`) — lands on the Menu tab, scrolled to that card. */
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  // Read once the business (and therefore its module tabs) has loaded — plain
  // window.location instead of useSearchParams() so this page stays a single
  // client component with no Suspense boundary needed (same convention as the
  // homepage's own categoryId/areaId deep-link seeding).
  useEffect(() => {
    if (!business) return;
    const item = new URL(window.location.href).searchParams.get("item");
    if (item) {
      setHighlightItemId(item);
      setActiveTab("menu");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function handleSwitchToClaim() {
    setSwitchingForClaim(true);
    try {
      await switchAccount();
      show("Switched to your Business account", "success");
      setClaimModalOpen(true);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSwitchingForClaim(false);
    }
  }

  function openReviewForm() {
    setActiveTab("reviews");
    setShowReviewForm(true);
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEditMyReview() {
    if (!myReview) return;
    setActiveTab("reviews");
    setEditingReview(myReview);
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function refreshMyReview(businessId: string) {
    reviewApi
      .mineForBusiness(businessId)
      .then(setMyReview)
      .catch(() => setMyReview(null));
  }

  const loadReviews = useCallback(
    (businessId: string, page: number, sort: ReviewSortOption = reviewSort) => {
      setReviewsLoading(true);
      setReviewsError(null);
      setReviewsAuthRequired(false);
      reviewApi
        .listForBusiness(businessId, page, 10, sort)
        .then((res) => {
          setReviews(res.content);
          setReviewTotalPages(res.totalPages);
        })
        .catch((err) => {
          // Reviews require auth per current backend rules — a polished CTA
          // renders for the logged-out case instead of a raw 401/403 banner.
          if (user) {
            setReviewsError(errorMessage(err));
          } else {
            setReviewsAuthRequired(true);
          }
        })
        .finally(() => setReviewsLoading(false));
    },
    [user, reviewSort]
  );

  function changeReviewSort(sort: ReviewSortOption) {
    setReviewSort(sort);
    setReviewPage(0);
    if (business) loadReviews(business.id, 0, sort);
  }

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    businessApi
      .getBySlug(slug)
      .then((b) => {
        if (cancelled) return;
        setBusiness(b);
        rememberBusiness(b);
        trackProfileView(b.id); // deduped in lib/analytics — once per ~30min per tab
        loadReviews(b.id, 0);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function refreshReviews() {
    if (business) loadReviews(business.id, reviewPage);
  }

  useEffect(() => {
    if (!business || !user) {
      setMyReview(null);
      return;
    }
    refreshMyReview(business.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id, user]);

  const [similarBusinesses, setSimilarBusinesses] = useState<BusinessResponse[]>([]);

  useEffect(() => {
    if (!business) return;
    let cancelled = false;
    // BusinessResponse only carries categoryName, not categoryId — look the id
    // up from the public category list rather than fabricating a filter.
    referenceApi
      .categories()
      .then((categories) => {
        const category = categories.find((c) => c.name === business.categoryName);
        if (!category) return null;
        return businessApi.search({ categoryId: category.id, sort: "rating", size: 7 });
      })
      .then((res) => {
        if (cancelled || !res) return;
        setSimilarBusinesses(res.content.filter((b) => b.id !== business.id).slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [business?.id, business?.categoryName]);

  function refreshBusiness() {
    if (!slug) return;
    businessApi.getBySlug(slug).then((b) => {
      setBusiness(b);
      rememberBusiness(b);
    });
  }

  if (loading) return <PageSpinner />;
  if (error || !business) return <ErrorBanner message={error ?? "Business not found"} />;

  const photos = business.photoUrls;

  // "About" shows only when the business has something beyond the always-present
  // basics (name/category/location/phone, which the sidebar already covers).
  const hasAboutData =
    !!business.description ||
    !!business.whatsappNumber ||
    !!business.email ||
    !!business.websiteUrl ||
    !!business.facebookUrl ||
    !!business.instagramUrl ||
    !!business.operatingHours ||
    business.attributes.length > 0 ||
    !!business.hasFaq;

  // Category-specific module tabs (spec Phase 2): driven by category.kind, and
  // only shown when the module actually has data (categoryModules flags from the
  // detail response — no module lists are fetched until a tab is opened).
  const moduleDefs = modulesForKind(business.categoryKind).filter((m) =>
    moduleHasData(m.key, business.categoryModules)
  );

  // Menu (restaurants) and Services (salons) are the only module tabs that lead
  // to a live order/booking flow today — call that one out so it doesn't read
  // as just another informational tab like Photos or Updates.
  const commerceModuleKey = canSellDirect(business.categoryKind)
    ? "menu"
    : canBook(business.categoryKind)
      ? "services"
      : null;

  // A tab is only offered when that business actually has content for it.
  const visibleTabs: BusinessTab[] = [
    { key: "reviews", label: "Reviews" },
    ...(hasAboutData ? [{ key: "about", label: "About" }] : []),
    ...moduleDefs.map((m) => ({ key: m.key as string, label: m.publicLabel, highlight: m.key === commerceModuleKey })),
    ...(photos.length > 0 ? [{ key: "photos", label: "Photos" }] : []),
    ...(business.hasUpdates ? [{ key: "updates", label: "Updates" }] : []),
    { key: "location", label: "Location" },
  ];

  return (
    <div>
      <BusinessHeroGallery business={business} />

      {business.flagged && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-rose-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-rose-700">Consumer alert</p>
            <p className="mt-0.5 text-sm text-rose-700/90">
              This listing was flagged by our moderation team for{" "}
              {business.flagReason ? REPORT_REASON_LABELS[business.flagReason] ?? business.flagReason : "a policy violation"}.
              Please exercise discretion.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main column */}
        <div className="lg:col-span-2">
          {/* Action row: a prominent primary CTA, then a header ⋯ menu for the
              occasional actions (Share/Report) right next to it — not pushed to the
              far edge with justify-between, which left an odd empty gap between them. */}
          <div className="flex flex-wrap items-center gap-2">
            <div>
              {user && user.id !== business.ownerUserId && !showReviewForm && !editingReview && (
                myReview ? (
                  <Button variant="outline" onClick={openEditMyReview}>Edit your review</Button>
                ) : (
                  <Button onClick={openReviewForm}>Write a Review</Button>
                )
              )}
            </div>
            <BusinessHeaderMenu business={business} />
          </div>

          {/* Google-Maps-place-sheet-style primary actions, then the reaction row. */}
          <div className="mt-3">
            <BusinessActions
              businessId={business.id}
              contactNumber={business.contactNumber}
              latitude={business.latitude}
              longitude={business.longitude}
              onMessageClick={() => setMessageWidgetState("open")}
            />
          </div>
          <div className="mt-3">
            <BusinessReactionBar business={business} />
          </div>

          <BusinessTabs tabs={visibleTabs} active={activeTab} onChange={setActiveTab} />

          {/* About — only rendered when the business has any of this data (hasAboutData
              includes hasFaq, so the tab still appears for an FAQ-only business even
              with no description/hours/etc.) */}
          {hasAboutData && (
            <section role="tabpanel" aria-label="About" hidden={activeTab !== "about"}>
              <BusinessAbout business={business} />
              <div className="mt-6">
                <BusinessFaq businessId={business.id} />
              </div>
            </section>
          )}

          {/* Category modules — mounted only while their tab is active, so each
              module's list is fetched on open and never before (spec Phase 2). */}
          {moduleDefs.map((m) =>
            activeTab === m.key ? (
              <section key={m.key} role="tabpanel" aria-label={m.publicLabel}>
                <CategoryModulePanel
                  moduleKey={m.key}
                  heading={m.publicLabel}
                  businessId={business.id}
                  businessName={business.name}
                  businessSlug={business.slug}
                  highlightItemId={m.key === "menu" ? highlightItemId : null}
                />
              </section>
            ) : null
          )}

          {/* Photos — hidden entirely with no photos (empty-state rule) */}
          {photos.length > 0 && (
            <section role="tabpanel" aria-label="Photos" hidden={activeTab !== "photos"}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-ink-900">Photos ({photos.length})</h2>
                <button
                  type="button"
                  onClick={() => {
                    setPhotosModalIndex(null);
                    setPhotosModalOpen(true);
                  }}
                  className="text-sm font-semibold text-crimson-700 hover:underline"
                >
                  {photos.length === 1 ? "View photo" : `See all ${photos.length} photos`}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.slice(0, 8).map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPhotosModalIndex(i);
                      setPhotosModalOpen(true);
                    }}
                    aria-label={`Open photo ${i + 1} of ${photos.length}`}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-ink-100"
                  >
                    <GalleryImage
                      src={url}
                      alt={`${business.name} photo ${i + 1}`}
                      sizes="(max-width: 640px) 33vw, 25vw"
                      className="transition-transform duration-200 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Updates — mounted only while active; shown only when ≥1 published update */}
          {business.hasUpdates && activeTab === "updates" && (
            <section role="tabpanel" aria-label="Updates">
              <BusinessUpdates businessId={business.id} />
            </section>
          )}

          {/* Location */}
          <section role="tabpanel" aria-label="Location" hidden={activeTab !== "location"}>
            <h2 className="font-display text-lg font-semibold text-ink-900 mb-3">Location</h2>
            {/* Directions live in the map overlay pill (MapPreview) and the
                BusinessActions grid above — a third standalone pill here
                would just be the same action a third time. */}
            <MapPreview latitude={business.latitude} longitude={business.longitude} name={business.name} businessId={business.id} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-start gap-2.5 text-sm text-ink-700">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none text-ink-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <span>
                  {business.areaName}, {business.cityName}
                </span>
              </p>
            </div>
          </section>

          {/* Reviews — the default section; stays visible on first load (spec) */}
          <section role="tabpanel" aria-label="Reviews" hidden={activeTab !== "reviews"}>
            <div id="reviews" className="scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h2 className="font-display text-lg sm:text-xl font-bold text-ink-900">Recommended Reviews</h2>
              {!reviewsAuthRequired && reviews.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  Sort by
                  <select
                    value={reviewSort}
                    onChange={(e) => changeReviewSort(e.target.value as ReviewSortOption)}
                    className={cn(
                      "min-h-11 rounded-full border border-ink-200 bg-surface px-3 text-xs font-medium text-ink-700 dark:border-ink-700",
                      focusRing
                    )}
                  >
                    <option value="newest">Newest</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </label>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6 mb-2">
              {business.reviewCount === 0 ? (
                <p className="text-sm text-ink-500">New · no reviews yet</p>
              ) : (
                <div className="text-center">
                  <p className="font-display text-3xl font-extrabold text-ink-900">{business.averageRating.toFixed(1)}</p>
                  <RatingBoxes rating={business.averageRating} size="md" />
                </div>
              )}
              <RatingBreakdownChart businessId={business.id} />
            </div>

            {showReviewForm && (
              <div className="mt-3">
                <ReviewForm
                  businessId={business.id}
                  onCancel={() => setShowReviewForm(false)}
                  onDone={() => {
                    setShowReviewForm(false);
                    refreshReviews();
                    refreshMyReview(business.id);
                  }}
                />
              </div>
            )}
            {editingReview && (
              <div className="mt-3">
                <ReviewForm
                  businessId={business.id}
                  editing={editingReview}
                  onCancel={() => setEditingReview(null)}
                  onDone={() => {
                    setEditingReview(null);
                    refreshReviews();
                    refreshMyReview(business.id);
                  }}
                />
              </div>
            )}

            <div className="mt-4">
              {reviewsLoading && <PageSpinner />}

              {!reviewsLoading && reviewsAuthRequired && (
                <div className="rounded-xl border border-ink-100 bg-sand-50/60 p-6 text-center">
                  <p className="font-display text-base font-semibold text-ink-900">Share your experience</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Log in to read what others said and write your own review of {business.name}.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button size="sm" onClick={openLogin}>
                      Log in
                    </Button>
                    <Button size="sm" variant="outline" onClick={openSignup}>
                      Sign up
                    </Button>
                  </div>
                </div>
              )}

              {!reviewsLoading && !reviewsAuthRequired && reviewsError && <ErrorBanner message={reviewsError} />}

              {!reviewsLoading && !reviewsAuthRequired && !reviewsError && reviews.length === 0 && (
                <EmptyState
                  title="No reviews yet"
                  description="Be the first to share your experience with this business."
                  action={
                    user && user.id !== business.ownerUserId && !showReviewForm && !myReview ? (
                      <Button size="sm" onClick={openReviewForm}>
                        Write the first review
                      </Button>
                    ) : undefined
                  }
                />
              )}

              {!reviewsLoading &&
                !reviewsAuthRequired &&
                !reviewsError &&
                reviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    onChanged={() => {
                      refreshReviews();
                      refreshMyReview(business.id);
                    }}
                    onEdit={setEditingReview}
                  />
                ))}
              <Pagination
                page={reviewPage}
                totalPages={reviewTotalPages}
                onChange={(p) => {
                  setReviewPage(p);
                  loadReviews(business.id, p);
                }}
              />
            </div>
            </div>
          </section>

          {similarBusinesses.length > 0 && (
            <div className="mt-8 border-t border-ink-100 pt-6">
              <BusinessCarousel title="Similar businesses nearby" businesses={similarBusinesses} />
            </div>
          )}
        </div>

        {/* Sidebar — sticky on desktop so it stays useful while the (much longer) main column scrolls. */}
        <div className="space-y-5 lg:sticky lg:top-20">
          <OfferBusinessBanner businessId={business.id} />

          <MapPreview latitude={business.latitude} longitude={business.longitude} name={business.name} businessId={business.id} />

          {business.verified && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="flex items-center gap-2">
                <VerifiedBadge compact />
                <p className="text-sm font-semibold text-brand-800">Verified Business</p>
              </div>
              <p className="mt-1.5 text-xs text-brand-700/80 leading-relaxed">
                Jachai has verified this business&apos;s registered contact number.
              </p>
            </div>
          )}

          {!business.claimed && user?.role === "BUSINESS_OWNER" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Unclaimed listing</p>
              <p className="mt-1.5 text-xs text-amber-800/80 leading-relaxed">
                This business hasn&apos;t been claimed by its owner yet. Is it yours?
              </p>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setClaimModalOpen(true)}>
                Claim this business
              </Button>
            </div>
          )}

          {/* A personal (CONSUMER) account can't claim directly — claiming is a
              Business-account action (spec update: two-account model). Point
              them at switching/creating one instead of a late 403 mid-claim. */}
          {!business.claimed && user && user.role !== "BUSINESS_OWNER" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Unclaimed listing</p>
              <p className="mt-1.5 text-xs text-amber-800/80 leading-relaxed">
                Is this your business? Claim it from a Business account.
              </p>
              {profile?.hasLinkedAccount ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={handleSwitchToClaim}
                  loading={switchingForClaim}
                >
                  Switch to your Business account
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setCreateBizModalOpen(true)}>
                  Create a Business account
                </Button>
              )}
            </div>
          )}

          <ClaimBusinessModal
            open={claimModalOpen}
            onClose={() => setClaimModalOpen(false)}
            businessId={business.id}
            businessName={business.name}
            onClaimed={refreshBusiness}
          />
          <CreateBusinessAccountModal open={createBizModalOpen} onClose={() => setCreateBizModalOpen(false)} />

          {/* Desktop only — mobile reaches the same chat via the BusinessActions grid's
              Message tile above, no need for a second, redundant entry point. */}
          <div className="hidden sm:block">
            <BusinessMessageSidebarCard business={business} onOpen={() => setMessageWidgetState("open")} />
          </div>

          <div className="rounded-xl border border-ink-100/70 bg-surface p-4 shadow-card space-y-3">
            <a
              href={`tel:${business.contactNumber}`}
              onClick={() => trackEvent(business.id, "PHONE_CLICK")}
              className="flex items-center gap-2.5 text-sm text-ink-700 hover:text-crimson-700 break-all"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 1-2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {business.contactNumber}
            </a>
            {business.operatingHours && (
              <div className="flex items-start gap-2.5 text-sm text-ink-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-400 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="whitespace-pre-wrap">{business.operatingHours}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5 text-sm text-ink-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-400 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <span>
                {business.areaName}, {business.cityName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <PhotoGalleryModal
        open={photosModalOpen}
        onClose={() => setPhotosModalOpen(false)}
        photos={photos}
        businessName={business.name}
        initialIndex={photosModalIndex}
      />

      {/* Hidden while the chat is open (full-screen on mobile, floating bottom-right on
          desktop) so it can't visually collide with either. */}
      {messageWidgetState !== "open" && <CartBar businessId={business.id} businessSlug={business.slug} />}

      <BusinessMessageWidget
        state={messageWidgetState}
        onClose={() => setMessageWidgetState("closed")}
        onMinimize={() => setMessageWidgetState("minimized")}
        onMaximize={() => setMessageWidgetState("open")}
        business={business}
        currentUserId={user?.id}
        isLoggedIn={!!user}
        onLogin={openLogin}
      />
    </div>
  );
}

/** Routes a category module key to its public showcase renderer (mounted only while active). */
function CategoryModulePanel({
  moduleKey,
  heading,
  businessId,
  businessName,
  businessSlug,
  highlightItemId,
}: {
  moduleKey: ModuleKey;
  heading: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  highlightItemId?: string | null;
}) {
  switch (moduleKey) {
    case "menu":
      return (
        <BusinessMenu
          businessId={businessId}
          businessName={businessName}
          businessSlug={businessSlug}
          highlightItemId={highlightItemId}
        />
      );
    case "products":
      return <BusinessProducts businessId={businessId} />;
    case "team":
      return <BusinessTeam businessId={businessId} heading={heading} />;
    case "facilities":
      return (
        <BusinessServiceShowcase businessId={businessId} businessName={businessName} section="FACILITY" heading={heading} />
      );
    case "services":
    default:
      return (
        <BusinessServiceShowcase businessId={businessId} businessName={businessName} section="OFFERING" heading={heading} />
      );
  }
}