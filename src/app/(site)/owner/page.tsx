"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { businessApi } from "@/lib/api";
import { RoleGate } from "@/components/role-gate";
import { BusinessAccountCta } from "@/components/business-account-cta";
import { rememberBusinesses } from "@/lib/business-cache";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { BusinessResponse } from "@/lib/types";
import { formatReviewCount } from "@/lib/utils";
import { VerifiedBadge } from "@/components/verified-badge";
import { RatingBoxes } from "@/components/rating-boxes";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";

function MyBusinessesContent() {
  const { show } = useToast();
  const [businesses, setBusinesses] = useState<BusinessResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    businessApi
      .mine()
      .then((list) => {
        setBusinesses(list);
        rememberBusinesses(list);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}"? It will be archived, not permanently deleted.`)) return;
    try {
      await businessApi.remove(id);
      show("Listing removed", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">My businesses</h1>
        <Link href="/owner/new">
          <Button>+ Add a business</Button>
        </Link>
      </div>

      {loading && <PageSpinner />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && businesses.length === 0 && (
        <EmptyState
          title="You haven't listed a business yet"
          description="Create your first listing to start collecting reviews."
          action={
            <Link href="/owner/new">
              <Button>+ Add a business</Button>
            </Link>
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {businesses.map((b) => (
          <div key={b.id} className="rounded-md border border-ink-100 bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/business/${b.slug}`} className="font-display font-semibold text-ink-900 hover:underline">
                    {b.name}
                  </Link>
                  {b.verified && <VerifiedBadge compact />}
                </div>
                <p className="text-xs text-ink-400 mt-0.5">
                  {b.categoryName} · {b.areaName}, {b.cityName}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <RatingBoxes rating={b.averageRating} size="sm" />
                  <span className="text-xs text-ink-500">
                    {b.averageRating.toFixed(1)} ({formatReviewCount(b.reviewCount)})
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Link href={`/owner/${b.id}`}>
                <Button size="sm" variant="outline">
                  Manage
                </Button>
              </Link>
              <Link href={`/owner/${b.id}/edit`}>
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              </Link>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => handleDelete(b.id, b.name)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnerBusinessesPage() {
  return (
    <RoleGate allow={["BUSINESS_OWNER"]} fallback={<BusinessAccountCta />}>
      <MyBusinessesContent />
    </RoleGate>
  );
}
