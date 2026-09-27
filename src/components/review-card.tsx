"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { MoreHorizontal } from "lucide-react";
import { reviewApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { avatarColorClass, avatarInitials, cn, focusRing, interactiveTransition, timeAgo, truncateId } from "@/lib/utils";
import type { ReviewResponse, VoteType } from "@/lib/types";
import { RatingBoxes } from "./rating-boxes";
import { Badge } from "./ui/misc";
import { IconButton } from "./ui/icon-button";
import { ReportButton } from "./report-button";
import { PhotoGalleryModal } from "./photo-gallery-modal";

const CONTENT_PREVIEW_LENGTH = 220;

export function ReviewCard({
  review,
  onChanged,
  onEdit,
}: {
  review: ReviewResponse;
  onChanged?: () => void;
  onEdit?: (review: ReviewResponse) => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const { t } = useLanguage();
  const [voting, setVoting] = useState<VoteType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failedPhotoIndexes, setFailedPhotoIndexes] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [counts, setCounts] = useState({
    USEFUL: review.usefulCount,
    FUNNY: review.funnyCount,
    COOL: review.coolCount,
  });
  const [reacted, setReacted] = useState<Set<VoteType>>(new Set());

  const isOwnReview = user?.id === review.userId;
  const content = review.content ?? "";
  const isLong = content.length > CONTENT_PREVIEW_LENGTH;
  const shownContent = expanded || !isLong ? content : `${content.slice(0, CONTENT_PREVIEW_LENGTH).trimEnd()}…`;

  async function vote(type: VoteType) {
    if (reacted.has(type) || voting) return;
    setVoting(type);
    try {
      await reviewApi.vote(review.id, type);
      setReacted((prev) => new Set(prev).add(type));
      setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      onChanged?.();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setVoting(null);
    }
  }

  async function handleDelete() {
    if (!confirm(t("review_card.confirm_delete"))) return;
    setDeleting(true);
    try {
      await reviewApi.remove(review.id);
      show(t("review_card.toast.deleted"), "success");
      onChanged?.();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  }

  const displayName = review.userName || t("review_card.anonymous_reviewer", { id: truncateId(review.userId) });

  return (
    <div className="border-b border-ink-100 py-5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
              avatarColorClass(review.userName ?? review.userId)
            )}
          >
            {avatarInitials(review.userName)}
          </div>
          <div>
            <p className="text-sm font-bold text-ink-900">{displayName}</p>
            <p className="text-xs text-ink-400">{timeAgo(review.createdAt)}</p>
            <div className="mt-1 flex items-center gap-2">
              <RatingBoxes rating={review.rating} size="xs" />
              {review.visibilityStatus === "NOT_RECOMMENDED" && (
                <Badge tone="gold">{t("review_card.not_recommended")}</Badge>
              )}
            </div>
          </div>
        </div>
        <ReportButton
          targetType="REVIEW"
          targetId={review.id}
          trigger={(openModal) => (
            <IconButton variant="ghost" size="sm" onClick={openModal} aria-label="Report this review">
              <MoreHorizontal size={18} strokeWidth={1.75} />
            </IconButton>
          )}
        />
      </div>

      {content && (
        <p className="mt-2 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
          {shownContent}
          {isLong && !expanded && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="font-semibold text-crimson-700 hover:underline"
              >
                {t("review_card.read_more")}
              </button>
            </>
          )}
        </p>
      )}

      {review.photoUrls.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {review.photoUrls.map((url, i) =>
            failedPhotoIndexes.has(i) ? null : (
              <button
                key={i}
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open photo ${i + 1} of ${review.photoUrls.length}`}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-ink-100"
              >
                <Image
                  src={url}
                  alt="Review photo"
                  fill
                  className="object-cover"
                  sizes="80px"
                  onError={() => setFailedPhotoIndexes((prev) => new Set(prev).add(i))}
                />
              </button>
            )
          )}
        </div>
      )}

      <PhotoGalleryModal
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        photos={review.photoUrls}
        businessName={displayName}
        initialIndex={lightboxIndex}
      />

      {review.ownerReply && (
        <div className="mt-3 rounded-r-lg border-l-2 border-ink-200 bg-ink-50/60 pl-3 py-2 dark:border-ink-700 dark:bg-ink-800/40">
          <p className="text-xs font-bold text-ink-700">
            {t("review_card.owner_response")}
            {review.ownerRepliedAt && (
              <span className="ml-1.5 font-normal text-ink-400">· {timeAgo(review.ownerRepliedAt)}</span>
            )}
          </p>
          <p className="mt-1 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{review.ownerReply}</p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ReactionButton
            icon={<LightbulbIcon />}
            count={counts.USEFUL}
            active={reacted.has("USEFUL")}
            disabled={!user || voting !== null}
            label={t("review_card.mark_useful")}
            displayLabel={t("review_card.useful_short")}
            onClick={() => vote("USEFUL")}
          />
          <ReactionButton
            icon={<SmileyIcon />}
            count={counts.FUNNY}
            active={reacted.has("FUNNY")}
            disabled={!user || voting !== null}
            label={t("review_card.mark_funny")}
            displayLabel={t("review_card.funny_short")}
            onClick={() => vote("FUNNY")}
          />
          <ReactionButton
            icon={<SunglassesIcon />}
            count={counts.COOL}
            active={reacted.has("COOL")}
            disabled={!user || voting !== null}
            label={t("review_card.mark_cool")}
            displayLabel={t("review_card.cool_short")}
            onClick={() => vote("COOL")}
          />
        </div>

        {isOwnReview && review.editable && (
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => onEdit?.(review)}
              className={cn("rounded font-medium text-crimson-700 hover:underline", focusRing)}
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn("rounded font-medium text-rose-600 hover:underline disabled:opacity-50", focusRing)}
            >
              {t("common.delete")}
            </button>
          </div>
        )}
        {isOwnReview && !review.editable && (
          <span className="text-xs text-ink-300">{t("review_card.edit_window_closed")}</span>
        )}
      </div>
    </div>
  );
}

function ReactionButton({
  icon,
  count,
  active,
  disabled,
  label,
  displayLabel,
  onClick,
}: {
  icon: ReactNode;
  count: number;
  active: boolean;
  disabled: boolean;
  label: string;
  displayLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium disabled:cursor-default disabled:opacity-60",
        interactiveTransition,
        focusRing,
        active
          ? "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-400"
          : "text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:hover:bg-transparent disabled:hover:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{displayLabel}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function LightbulbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.55.42.6 1.03.6 1.6V16h6v-.6c0-.57.05-1.18.6-1.6A6 6 0 0 0 12 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmileyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10.5h.01M15.5 10.5h.01" strokeLinecap="round" />
      <path d="M8 14.3c1 1.4 2.4 2.1 4 2.1s3-.7 4-2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunglassesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 8.5h4.8a2.7 2.7 0 0 1 2.6 2 2.2 2.2 0 0 0 4.2 0 2.7 2.7 0 0 1 2.6-2h4.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5.8" cy="12.3" r="3.2" />
      <circle cx="18.2" cy="12.3" r="3.2" />
    </svg>
  );
}
