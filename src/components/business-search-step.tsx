"use client";

import { useState } from "react";
import { businessApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { BusinessResponse } from "@/lib/types";
import { formatReviewCount } from "@/lib/utils";
import { RatingBoxes } from "@/components/rating-boxes";
import { VerifiedBadge } from "@/components/verified-badge";
import { ClaimBusinessModal } from "@/components/claim-business-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/misc";

const EXAMPLE_QUERIES = ["KFC", "Biriyani House Mirpur", "Rahman Electronics Uttara"];

function ResultCard({ business, onClaim }: { business: BusinessResponse; onClaim: () => void }) {
  const { user } = useAuth();
  const isOwnBusiness = !!user && user.id === business.ownerUserId;

  return (
    <div className="rounded-lg border border-ink-100 bg-surface p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-display font-semibold text-ink-900">{business.name}</p>
          {business.verified && <VerifiedBadge compact />}
        </div>
        <p className="text-xs text-ink-400 mt-0.5">
          {business.categoryName} · {business.areaName}, {business.cityName}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <RatingBoxes rating={business.averageRating} size="sm" />
          <span className="text-xs text-ink-500">
            {business.averageRating.toFixed(1)} ({formatReviewCount(business.reviewCount)})
          </span>
        </div>
      </div>
      {isOwnBusiness ? (
        <p className="text-xs font-medium text-ink-500">This is your business</p>
      ) : business.claimed ? (
        <div className="text-right">
          <p className="text-xs text-ink-400">Already claimed</p>
          <button
            type="button"
            onClick={onClaim}
            className="text-xs font-medium text-crimson-700 hover:underline"
          >
            Is this your business? Dispute this claim
          </button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={onClaim}>
          Claim this business
        </Button>
      )}
    </div>
  );
}

/** Yelp-style pre-step: search for an existing listing before "add a business" opens the full form. */
export function BusinessSearchStep({ onAddNew }: { onAddNew: (searchedName: string) => void }) {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<BusinessResponse[] | null>(null);
  const [claimTarget, setClaimTarget] = useState<BusinessResponse | null>(null);

  const canSearch = query.trim().length >= 2;

  async function search() {
    if (!canSearch) return;
    setSearching(true);
    try {
      const found = await businessApi.potentialDuplicates(query.trim());
      setResults(found);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by business name, location, or both…"
          autoFocus
          className="w-full rounded-full border border-ink-200 bg-surface px-5 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-crimson-500/30 focus:border-crimson-500"
        />
        <Button size="lg" className="shrink-0" onClick={search} loading={searching} disabled={!canSearch}>
          Search
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-400">
        e.g. {EXAMPLE_QUERIES.map((e, i) => (
          <span key={e}>
            {i > 0 && ", "}
            &quot;{e}&quot;
          </span>
        ))}
      </p>

      {searching && (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      )}

      {!searching && results !== null && (
        <div className="mt-8">
          {results.length > 0 ? (
            <>
              <h2 className="font-display text-base font-semibold text-ink-900 mb-3">
                Businesses you may be looking for
              </h2>
              <div className="space-y-3">
                {results.map((b) => (
                  <ResultCard key={b.id} business={b} onClaim={() => setClaimTarget(b)} />
                ))}
              </div>
              <div className="mt-5 text-center">
                <Button variant="ghost" onClick={() => onAddNew(query.trim())}>
                  + Add a new business
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Can't find your business?"
              description="If your business isn't listed yet, you can add it to Jachai."
              action={
                <Button onClick={() => onAddNew(query.trim())}>+ Add a new business</Button>
              }
            />
          )}
        </div>
      )}

      <ClaimBusinessModal
        open={claimTarget !== null}
        onClose={() => setClaimTarget(null)}
        businessId={claimTarget?.id ?? ""}
        businessName={claimTarget?.name ?? ""}
        onClaimed={() => setClaimTarget(null)}
        alreadyClaimed={claimTarget?.claimed ?? false}
      />
    </div>
  );
}
