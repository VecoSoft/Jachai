"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completenessApi, galleryApi } from "@/lib/api";
import { errorMessage } from "@/lib/toast-context";
import type { BusinessResponse, CompletenessResponse } from "@/lib/types";
import { ProfileCompletenessCard } from "@/components/profile-completeness-card";
import { BusinessPerformance } from "@/components/business-performance";
import { ErrorBanner } from "@/components/ui/misc";
import { PendingPhotosNotice } from "@/components/pending-photos-notice";
import { ListingIntegrityCard } from "@/components/owner/listing-integrity-card";

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-surface p-3 text-center">
      <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
      <p className="mt-0.5 text-xs text-ink-400">{label}</p>
    </div>
  );
}

/** Completeness recommendation keys that map to a category-module section route. */
const MODULE_ITEM_KEYS = ["menu", "services", "team", "products", "facilities"];

/**
 * The owner workspace "Overview" — at-a-glance metrics, profile completeness, and
 * Business performance. (Was the old dashboard's Overview tab.)
 */
export function OwnerOverviewPanel({ business }: { business: BusinessResponse }) {
  const router = useRouter();
  const [completeness, setCompleteness] = useState<CompletenessResponse | null>(null);
  const [galleryCount, setGalleryCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    completenessApi
      .get(business.id)
      .then((c) => !cancelled && setCompleteness(c))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    galleryApi
      .list(business.id)
      .then((p) => !cancelled && setGalleryCount(p.length))
      .catch(() => !cancelled && setGalleryCount(0));
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  function jumpToCompletenessItem(key: string) {
    if (key === "gallery") router.push(`/owner/${business.id}/photos`);
    else if (MODULE_ITEM_KEYS.includes(key)) router.push(`/owner/${business.id}/sections/${key}`);
    else router.push(`/owner/${business.id}/edit`); // description, hours, cover, logo, presence
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-semibold text-ink-900">Overview</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Average rating" value={business.averageRating.toFixed(1)} />
        <MetricCard label="Reviews" value={business.reviewCount} />
        <MetricCard label="Gallery photos" value={galleryCount ?? "—"} />
        <MetricCard label="Completeness" value={completeness ? `${completeness.percentage}%` : "—"} />
      </div>

      <ListingIntegrityCard business={business} />

      <PendingPhotosNotice businessId={business.id} />

      {error && <ErrorBanner message={error} />}
      {completeness && <ProfileCompletenessCard data={completeness} onJump={jumpToCompletenessItem} />}

      <BusinessPerformance businessId={business.id} />
    </div>
  );
}
