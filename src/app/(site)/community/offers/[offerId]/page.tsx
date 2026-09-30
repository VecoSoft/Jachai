"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiClientError, offerApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { formatDate, formatDateTime, formatReviewCount, timeUntil } from "@/lib/utils";
import { OFFER_AVAILABILITY_LABELS } from "@/lib/offer-constants";
import type { OfferClaimResponse, OfferResponse } from "@/lib/types";
import { OfferTypeBadge } from "@/components/offer-type-badge";
import { RedemptionCodeCard } from "@/components/redemption-code-card";
import { ReportButton } from "@/components/report-button";
import { VerifiedBadge } from "@/components/verified-badge";
import { RatingBoxes } from "@/components/rating-boxes";
import { Badge, EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function OfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { show } = useToast();

  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [savedBusy, setSavedBusy] = useState(false);
  const [claim, setClaim] = useState<OfferClaimResponse | null>(null);

  const load = useCallback(() => {
    if (!offerId) return;
    setLoading(true);
    setError(null);
    setExpired(false);
    offerApi
      .get(offerId)
      .then(setOffer)
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 404) {
          setExpired(true);
        } else {
          setError(errorMessage(err));
        }
      })
      .finally(() => setLoading(false));
  }, [offerId]);

  useEffect(load, [load]);

  async function toggleSave() {
    if (!offer) return;
    if (!user) {
      openLogin();
      return;
    }
    setSavedBusy(true);
    const wasSaved = offer.saved;
    setOffer({ ...offer, saved: !wasSaved });
    try {
      if (wasSaved) await offerApi.unsave(offer.id);
      else await offerApi.save(offer.id);
    } catch (err) {
      setOffer((prev) => (prev ? { ...prev, saved: wasSaved } : prev));
      show(errorMessage(err), "error");
    } finally {
      setSavedBusy(false);
    }
  }

  async function claimOffer() {
    if (!offer) return;
    if (!user) {
      openLogin();
      return;
    }
    setClaiming(true);
    try {
      const res = await offerApi.claim(offer.id, offer.businessId);
      setClaim(res);
      show("Offer claimed successfully.", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <PageSpinner />;
  if (expired) {
    return (
      <div className="py-10">
        <EmptyState title="This offer has expired." description="It's no longer available — check the Offers page for what's currently active." action={
          <Link href="/community/offers">
            <Button size="sm" variant="outline">Browse offers</Button>
          </Link>
        } />
      </div>
    );
  }
  if (error || !offer) return <ErrorBanner message={error ?? "Offer not found"} />;

  const savingsPct =
    offer.originalPrice != null && offer.offerPrice != null && offer.originalPrice > 0
      ? Math.round(((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100)
      : null;

  const isActive = offer.effectiveStatus === "ACTIVE";
  const fullyClaimed = offer.maxTotalRedemptions != null && offer.claimCount >= offer.maxTotalRedemptions;
  const showOrderNow = offer.availability === "ONLINE" || offer.availability === "BOTH";
  const showClaim = offer.availability === "IN_STORE" || offer.availability === "BOTH";

  return (
    <div className="py-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {offer.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.imageUrl} alt={offer.title} className="mb-4 aspect-[16/9] w-full rounded-2xl border border-ink-100 object-cover" />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <OfferTypeBadge offer={offer} className="text-sm" />
            {offer.businessVerified && <VerifiedBadge compact />}
            {!isActive && <Badge tone="neutral">{offer.effectiveStatus === "EXPIRED" ? "Expired" : offer.effectiveStatus}</Badge>}
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold text-ink-900">{offer.title}</h1>
          <Link href={`/business/${offer.businessSlug}`} className="mt-1 inline-block text-sm font-medium text-crimson-700 hover:underline">
            {offer.businessName}
          </Link>

          {offer.originalPrice != null && offer.offerPrice != null && (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-crimson-700">৳{offer.offerPrice}</span>
              <span className="text-base text-ink-400 line-through">৳{offer.originalPrice}</span>
              {savingsPct != null && savingsPct > 0 && (
                <span className="text-sm font-semibold text-brand-700">Save {savingsPct}%</span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
            <span>
              Valid {formatDate(offer.validFrom)} – {formatDate(offer.validUntil)} ({timeUntil(offer.validUntil)})
            </span>
            <span>{OFFER_AVAILABILITY_LABELS[offer.availability]}</span>
          </div>

          {offer.description && (
            <div className="mt-5">
              <h2 className="font-display text-base font-semibold text-ink-900">Description</h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-700">{offer.description}</p>
            </div>
          )}

          {offer.termsAndConditions && (
            <div className="mt-5">
              <h2 className="font-display text-base font-semibold text-ink-900">Terms &amp; conditions</h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-500">{offer.termsAndConditions}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-5">
            {!isActive && <p className="text-sm text-ink-500">This offer is no longer available.</p>}
            {isActive && fullyClaimed && <p className="text-sm text-ink-500">Offer fully claimed.</p>}
            {isActive && !fullyClaimed && (
              <>
                {showOrderNow && (
                  <Link
                    href={
                      offer.menuItemId
                        ? `/business/${offer.businessSlug}?item=${offer.menuItemId}`
                        : `/business/${offer.businessSlug}`
                    }
                  >
                    <Button>Order Now</Button>
                  </Link>
                )}
                {showClaim && (
                  <Button variant={showOrderNow ? "outline" : "primary"} onClick={claimOffer} loading={claiming}>
                    Claim Offer
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" onClick={toggleSave} disabled={savedBusy}>
              {offer.saved ? "Saved ✓" : "Save"}
            </Button>
            <ReportButton targetType="OFFER" targetId={offer.id} />
          </div>

          {claim && (
            <div className="mt-6 max-w-sm">
              <RedemptionCodeCard claim={claim} />
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border border-ink-100/70 bg-surface p-4 shadow-card">
            <p className="text-sm font-semibold text-ink-900">{offer.businessName}</p>
            {offer.businessAverageRating != null && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <RatingBoxes rating={offer.businessAverageRating} size="sm" />
                <span className="text-xs font-bold text-ink-900">{offer.businessAverageRating.toFixed(1)}</span>
                <span className="text-[11px] text-ink-400">({formatReviewCount(offer.businessReviewCount)})</span>
              </div>
            )}
            <p className="mt-1.5 text-xs text-ink-500">
              {offer.areaName}, {offer.cityName}
            </p>
            <Link
              href={`/business/${offer.businessSlug}#reviews`}
              className="mt-3 inline-block text-xs font-semibold text-crimson-700 hover:underline"
            >
              View Reviews →
            </Link>
          </div>

          <p className="px-1 text-[11px] text-ink-400">Last updated {formatDateTime(offer.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
