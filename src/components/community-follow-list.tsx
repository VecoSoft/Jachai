"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { avatarColorClass, avatarInitials, formatMonthYear } from "@/lib/utils";
import type { CommunityFollowListItem } from "@/lib/types";
import { Button } from "./ui/button";
import { CommunityGenderBadge } from "./community-gender-badge";

/** Shared row list for the Following and Followers pages — same card, different data source and empty copy. */
export function CommunityFollowList({
  items,
  onToggled,
}: {
  items: CommunityFollowListItem[];
  onToggled: (userId: string, isFollowing: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <FollowRow key={item.author.id} item={item} onToggled={onToggled} />
      ))}
    </div>
  );
}

function FollowRow({
  item,
  onToggled,
}: {
  item: CommunityFollowListItem;
  onToggled: (userId: string, isFollowing: boolean) => void;
}) {
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();
  const { show } = useToast();
  const [toggling, setToggling] = useState(false);

  const isSelf = profile?.communityProfileId === item.author.id;
  const displayName = item.author.communityUsername ? `u/${item.author.communityUsername}` : "[deleted]";

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      openLogin();
      return;
    }
    setToggling(true);
    try {
      if (item.isFollowing) {
        await communityApi.unfollow(item.author.id);
      } else {
        await communityApi.follow(item.author.id);
      }
      onToggled(item.author.id, !item.isFollowing);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Link
      href={item.author.communityUsername ? `/community/u/${item.author.communityUsername}` : "#"}
      className="flex items-center gap-3 rounded-xl border border-ink-100 bg-surface p-3 transition-colors duration-150 hover:border-ink-200"
    >
      {item.author.communityAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.author.communityAvatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColorClass(
            item.author.communityUsername ?? item.author.id
          )}`}
        >
          {avatarInitials(item.author.communityUsername)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold text-ink-800">
          {displayName}
          {item.author.verified && <BadgeCheck size={13} className="shrink-0 text-brand-600" aria-label="Verified member" />}
          {item.author.communityUsername && <CommunityGenderBadge gender={item.author.gender} />}
        </p>
        <p className="truncate text-xs text-ink-400">
          {item.author.reviewCount} review{item.author.reviewCount === 1 ? "" : "s"}
          {item.author.memberSince && ` · Member since ${formatMonthYear(item.author.memberSince)}`}
        </p>
      </div>
      {!isSelf && (
        <Button size="sm" variant={item.isFollowing ? "outline" : "primary"} onClick={handleToggle} loading={toggling}>
          {item.isFollowing ? "Following" : "Follow"}
        </Button>
      )}
    </Link>
  );
}
