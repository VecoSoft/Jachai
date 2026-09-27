"use client";

import { useCallback, useEffect, useState } from "react";
import { fakeReviewApi, moderationApi } from "@/lib/api";
import { RoleGate } from "@/components/role-gate";
import { AdminNav } from "@/components/admin-nav";
import { errorMessage, useToast } from "@/lib/toast-context";
import { formatDateTime, truncateId } from "@/lib/utils";
import type { FakeReviewSignal, Review, VisibilityStatus } from "@/lib/types";
import { RatingBoxes } from "@/components/rating-boxes";
import { Badge, EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

const SIGNAL_LABELS: Record<string, string> = {
  CONTENT_PATTERN: "Content pattern",
  TIMING_PATTERN: "Timing pattern",
  RATING_CLUSTERING: "Rating clustering",
};

function SignalsPanel({ reviewId }: { reviewId: string }) {
  const { show } = useToast();
  const [signals, setSignals] = useState<FakeReviewSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  function load() {
    setLoading(true);
    fakeReviewApi.signalsFor(reviewId).then(setSignals).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, [reviewId]);

  async function reAnalyze() {
    setReanalyzing(true);
    try {
      await fakeReviewApi.reAnalyze(reviewId);
      show("Re-analysis triggered", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setReanalyzing(false);
    }
  }

  if (loading) return <p className="text-xs text-ink-400 px-4 py-2">Loading signals…</p>;

  return (
    <div className="bg-sand-100/60 px-4 py-3 border-t border-ink-100">
      {signals.length === 0 ? (
        <p className="text-xs text-ink-400">No signal breakdown recorded yet.</p>
      ) : (
        <div className="space-y-1.5">
          {signals.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">{SIGNAL_LABELS[s.signalType] ?? s.signalType}</span>
              <span className="text-ink-500">{s.detail}</span>
              <Badge tone={s.score > 70 ? "rose" : s.score > 30 ? "gold" : "brand"}>{s.score}/100</Badge>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="ghost" className="mt-2" onClick={reAnalyze} loading={reanalyzing}>
        Re-run analysis
      </Button>
    </div>
  );
}

function FlaggedReviewsContent() {
  const { show } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((p: number) => {
    setLoading(true);
    setError(null);
    moderationApi
      .flaggedReviews(p, 20)
      .then((res) => {
        setReviews(res.content);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(0), [load]);

  async function resolve(reviewId: string, resolution: VisibilityStatus) {
    const notes = prompt("Resolution notes (optional):") ?? undefined;
    setBusy(reviewId);
    try {
      await moderationApi.resolveFlaggedReview(reviewId, resolution, notes);
      show("Review resolved", "success");
      load(page);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Moderation</h1>
      <p className="text-sm text-ink-500 mb-6">
        Reviews flagged by the fake-review pipeline (spec §14) — medium and high confidence.
      </p>
      <AdminNav />

      {loading && <PageSpinner />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && reviews.length === 0 && <EmptyState title="No flagged reviews" />}
      {!loading && !error && reviews.length > 0 && (
        <div className="rounded-md border border-ink-100 bg-surface shadow-card divide-y divide-ink-100">
          {reviews.map((r) => (
            <div key={r.id}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <RatingBoxes rating={r.rating} size="xs" />
                      <Badge tone={r.suspicionScore > 70 ? "rose" : "gold"}>
                        Suspicion {r.suspicionScore}/100
                      </Badge>
                      <Badge tone="neutral">{r.visibilityStatus}</Badge>
                    </div>
                    <p className="text-xs text-ink-400 mt-1">
                      business {truncateId(r.businessId, 10)}… · {r.userName || `reviewer ${truncateId(r.userId, 10)}…`} ·{" "}
                      {formatDateTime(r.createdAt)}
                    </p>
                    {r.content && <p className="text-sm text-ink-700 mt-1.5">{r.content}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, "RECOMMENDED")} loading={busy === r.id}>
                    Restore (Recommended)
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve(r.id, "NOT_RECOMMENDED")} loading={busy === r.id}>
                    Keep as Not Recommended
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => resolve(r.id, "HIDDEN")} loading={busy === r.id}>
                    Hide review
                  </Button>
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="ml-auto text-xs text-crimson-700 hover:underline"
                  >
                    {expanded === r.id ? "Hide signals" : "View signal breakdown"}
                  </button>
                </div>
              </div>
              {expanded === r.id && <SignalsPanel reviewId={r.id} />}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); load(p); }} />
    </div>
  );
}

export default function AdminFlaggedReviewsPage() {
  return (
    <RoleGate allow={["ADMIN"]}>
      <FlaggedReviewsContent />
    </RoleGate>
  );
}
