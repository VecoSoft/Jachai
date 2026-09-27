"use client";

import { useState } from "react";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";

/**
 * The one Follow control style across Community — plain inline text (no pill/border/bg),
 * Instagram/Facebook-style. A 44px tap target lives on an invisible ::after pseudo-element
 * (relative + after:absolute after:-inset-*) rather than real padding, since the visible
 * text must stay exactly text-sm with no box around it. Tapping "Following" opens a confirm
 * sheet instead of unfollowing immediately. Shared by PostHeader (feed card + post detail)
 * and the community profile header so both are never two hand-duplicated implementations.
 */
export function FollowControl({
  targetId,
  displayName,
  following,
  onFollowingChange,
  className,
}: {
  /** The author's communityProfileId — same id space communityApi.follow/unfollow expect. */
  targetId: string;
  /** "u/username" — used in the aria-label and the unfollow confirm sheet's heading. */
  displayName: string;
  following: boolean;
  onFollowingChange: (following: boolean) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { show } = useToast();
  const [toggling, setToggling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doFollow() {
    setToggling(true);
    try {
      await communityApi.follow(targetId);
      onFollowingChange(true);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setToggling(false);
    }
  }

  async function doUnfollow() {
    setConfirmOpen(false);
    setToggling(true);
    try {
      await communityApi.unfollow(targetId);
      onFollowingChange(false);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setToggling(false);
    }
  }

  function handleTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      openLogin();
      return;
    }
    if (toggling) return;
    if (following) {
      setConfirmOpen(true);
    } else {
      doFollow();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        disabled={toggling}
        aria-label={`${following ? "Unfollow" : "Follow"} ${displayName}`}
        aria-pressed={following}
        className={cn(
          "relative shrink-0 whitespace-nowrap text-sm after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']",
          focusRing,
          toggling && "opacity-60",
          following
            ? "font-medium text-ink-500 dark:text-ink-400"
            : "font-semibold text-crimson-600 hover:text-crimson-700 dark:text-crimson-400",
          className
        )}
      >
        {following ? "Following" : "Follow"}
      </button>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="unfollow-confirm-heading">
        <div className="p-2 sm:p-3">
          <h2
            id="unfollow-confirm-heading"
            className="px-3 pb-2 pt-3 text-center text-sm font-semibold text-ink-900 dark:text-ink-100"
          >
            Unfollow {displayName}?
          </h2>
          <button
            type="button"
            onClick={doUnfollow}
            className={cn(
              "flex min-h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold text-rose-600 hover:bg-rose-500/10",
              focusRing
            )}
          >
            Unfollow
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className={cn(
              "flex min-h-12 w-full items-center justify-center rounded-lg text-[15px] text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800",
              focusRing
            )}
          >
            Cancel
          </button>
        </div>
      </Sheet>
    </>
  );
}
