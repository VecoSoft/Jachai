"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { messageApi, reviewApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { timeAgo, truncateId } from "@/lib/utils";
import type { BusinessResponse, MessageThread, ReviewResponse } from "@/lib/types";
import { RatingBoxes } from "@/components/rating-boxes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge, EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";

/** Owner's view of their reviews — includes hidden / under-review ones, with a
 *  jump to the customer's message thread when one exists. (Was the dashboard's Reviews tab.) */
export function OwnerReviewsPanel({ business }: { business: BusinessResponse }) {
  const { t } = useLanguage();
  const { show } = useToast();
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const load = useCallback(
    (p: number) => {
      setLoading(true);
      setError(null);
      reviewApi
        .ownerDashboard(business.id, p, 10, { rating: ratingFilter, unrepliedOnly, flaggedOnly })
        .then((res) => {
          setReviews(res.content);
          setTotalPages(res.totalPages);
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false));
    },
    [business.id, ratingFilter, unrepliedOnly, flaggedOnly]
  );

  useEffect(() => {
    setPage(0);
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    messageApi
      .businessInbox()
      .then((all) => setThreads(all.filter((t) => t.businessId === business.id)))
      .catch(() => {});
  }, [business.id]);

  function startReply(r: ReviewResponse) {
    setReplyDraft(r.ownerReply ?? "");
    setReplyingId(r.id);
  }

  function cancelReply() {
    setReplyingId(null);
    setReplyDraft("");
  }

  async function saveReply(id: string) {
    if (!replyDraft.trim()) return;
    setSavingReply(true);
    try {
      const updated = await reviewApi.reply(id, replyDraft.trim());
      setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
      cancelReply();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSavingReply(false);
    }
  }

  async function deleteReply(id: string) {
    if (!confirm(t("reviews_panel.confirm_delete_reply"))) return;
    try {
      const updated = await reviewApi.removeReply(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Reviews</h2>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-md border border-ink-100 bg-surface p-3 text-center">
          <p className="font-display text-2xl font-bold text-ink-900">{business.averageRating.toFixed(1)}</p>
          <p className="text-xs text-ink-400">Average rating</p>
        </div>
        <div className="rounded-md border border-ink-100 bg-surface p-3 text-center">
          <p className="font-display text-2xl font-bold text-ink-900">{business.reviewCount}</p>
          <p className="text-xs text-ink-400">Total reviews</p>
        </div>
        <div className="rounded-md border border-ink-100 bg-surface p-3 text-center">
          <p className="font-display text-2xl font-bold text-ink-900">{threads.length}</p>
          <p className="text-xs text-ink-400">Message threads</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={ratingFilter ?? ""}
          onChange={(e) => setRatingFilter(e.target.value ? Number(e.target.value) : null)}
          className="rounded-md border border-ink-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-700"
        >
          <option value="">All stars</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setUnrepliedOnly((v) => !v)}
          className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            unrepliedOnly
              ? "border-crimson-500 bg-crimson-50 text-crimson-700"
              : "border-ink-200 text-ink-600 hover:border-ink-300"
          }`}
        >
          Unreplied only
        </button>
        <button
          type="button"
          onClick={() => setFlaggedOnly((v) => !v)}
          className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            flaggedOnly
              ? "border-crimson-500 bg-crimson-50 text-crimson-700"
              : "border-ink-200 text-ink-600 hover:border-ink-300"
          }`}
        >
          Flagged only
        </button>
        {(ratingFilter != null || unrepliedOnly || flaggedOnly) && (
          <button
            type="button"
            onClick={() => {
              setRatingFilter(null);
              setUnrepliedOnly(false);
              setFlaggedOnly(false);
            }}
            className="text-xs font-medium text-ink-400 hover:text-ink-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <PageSpinner />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && (
        <>
          {reviews.length === 0 ? (
            <EmptyState title="No reviews match these filters" />
          ) : (
            <>
              {reviews.map((r) => {
                const thread = threads.find((t) => t.consumerUserId === r.userId);
                return (
                  <div key={r.id} className="border-b border-ink-100 py-4 last:border-0">
                    <div className="flex items-center gap-2">
                      <RatingBoxes rating={r.rating} size="xs" />
                      {r.visibilityStatus !== "RECOMMENDED" && (
                        <Badge tone={r.visibilityStatus === "HIDDEN" ? "rose" : "gold"}>
                          {r.visibilityStatus === "HIDDEN" ? "Hidden by moderation" : "Under review"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {r.userName || `reviewer ${truncateId(r.userId)}`} · {timeAgo(r.createdAt)}
                    </p>
                    {r.content && <p className="mt-1.5 text-sm text-ink-700">{r.content}</p>}

                    <div className="mt-2">
                      {replyingId === r.id ? (
                        <div className="space-y-2 rounded-lg border border-dashed border-ink-300 bg-sand-50/40 p-3">
                          <Textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            rows={3}
                            placeholder={t("reviews_panel.reply_placeholder")}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveReply(r.id)} loading={savingReply}>
                              {t("common.save")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelReply}>
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : r.ownerReply ? (
                        <div className="rounded-lg border border-ink-100 bg-sand-50/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-ink-700">
                              {t("reviews_panel.your_reply")}
                              {r.ownerRepliedAt && (
                                <span className="ml-1.5 font-normal text-ink-400">· {timeAgo(r.ownerRepliedAt)}</span>
                              )}
                            </p>
                            <div className="flex shrink-0 gap-2 text-xs">
                              <button type="button" onClick={() => startReply(r)} className="font-medium text-crimson-700 hover:underline">
                                {t("common.edit")}
                              </button>
                              <button type="button" onClick={() => deleteReply(r.id)} className="font-medium text-rose-600 hover:underline">
                                {t("common.delete")}
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.ownerReply}</p>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startReply(r)}>
                          {t("reviews_panel.reply_publicly")}
                        </Button>
                      )}

                      {thread && (
                        <Link
                          href={`/owner/inbox/${thread.id}`}
                          className="mt-1.5 block text-xs text-ink-400 hover:text-crimson-700 hover:underline"
                        >
                          {t("reviews_panel.continue_by_message")} →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(p) => {
                  setPage(p);
                  load(p);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
