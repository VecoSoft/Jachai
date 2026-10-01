"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { avatarColorClass, avatarInitials, cn, focusRing, timeAgo } from "@/lib/utils";
import type { CommunityAreaSummary, CommunityAuthorSummary } from "@/lib/types";
import { FollowControl } from "./community-follow-control";
import { CommunityGenderBadge } from "./community-gender-badge";

/**
 * Author identity row — Instagram/Facebook-style: avatar, then username + inline
 * "· Follow" all on one line (username truncates before Follow ever wraps), area/
 * timestamp subtitle on the second line. Shared by the feed card and the post detail
 * page so both read as the same product. Follow state is local-only (the post/comment
 * payload doesn't carry the viewer's follow relationship to the author) — see
 * FollowControl, which calls the same follow/unfollow endpoint as the Following/
 * Followers list, just without a server-confirmed starting state.
 */
export function PostHeader({
  author,
  area,
  createdAt,
  size = "sm",
}: {
  author: CommunityAuthorSummary;
  area?: CommunityAreaSummary | null;
  createdAt: string;
  size?: "sm" | "md";
}) {
  const { profile } = useAuth();
  const [following, setFollowing] = useState(false);

  const displayName = author.communityUsername ? `u/${author.communityUsername}` : "[deleted]";
  const avatarSize = size === "md" ? "h-9 w-9 text-xs" : "h-8 w-8 text-[11px]";
  const nameSize = size === "md" ? "text-sm" : "text-[13px]";
  const isSelf = profile?.communityProfileId === author.id;

  // Official "Jachai Team" announcements: brand identity + badge, no profile link, no follow.
  if (author.official) {
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-crimson-600 font-bold text-white", avatarSize)}>
          J
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cn("flex items-center gap-1 font-semibold text-ink-800", nameSize)}>
            {author.communityUsername ?? "Jachai Team"}
            <BadgeCheck size={size === "md" ? 15 : 13} className="shrink-0 text-brand-600" aria-label="Official account" />
            <span className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              Official
            </span>
          </p>
          <p className="text-xs text-ink-500">
            {timeAgo(createdAt)}
            {area && ` · ${area.name}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {author.communityAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.communityAvatarUrl}
          alt=""
          className={cn("shrink-0 rounded-full object-cover", avatarSize)}
        />
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
            avatarSize,
            avatarColorClass(author.communityUsername ?? author.id)
          )}
        >
          {avatarInitials(author.communityUsername)}
        </div>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn("flex items-center", nameSize)}>
          {author.communityUsername ? (
            <Link
              href={`/community/u/${author.communityUsername}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex min-w-0 items-center gap-0.5 truncate font-semibold text-ink-800 hover:underline",
                focusRing
              )}
            >
              <span className="truncate">{displayName}</span>
              {author.verified && <BadgeCheck size={size === "md" ? 15 : 13} className="shrink-0 text-brand-600" aria-label="Verified member" />}
            </Link>
          ) : (
            <span className="min-w-0 truncate font-semibold text-ink-800">{displayName}</span>
          )}
          {author.communityUsername && <CommunityGenderBadge gender={author.gender} className="ml-1" />}
          {!isSelf && author.communityUsername && (
            <>
              <span aria-hidden className="mx-1 shrink-0 text-ink-400">
                ·
              </span>
              <FollowControl
                targetId={author.id}
                displayName={displayName}
                following={following}
                onFollowingChange={setFollowing}
              />
            </>
          )}
        </p>
        <p className="text-xs text-ink-500">
          {timeAgo(createdAt)}
          {area && ` · ${area.name}`}
        </p>
      </div>
    </div>
  );
}
