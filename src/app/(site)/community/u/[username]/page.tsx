"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/toast-context";
import { avatarColorClass, avatarInitials, cn, formatMonthYear } from "@/lib/utils";
import type { CommunityCommentResponse, CommunityPostResponse, CommunityProfileResponse } from "@/lib/types";
import { CommunityPostCard } from "@/components/community-post-card";
import { FollowControl } from "@/components/community-follow-control";
import { EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";
import { CommunityGenderBadge } from "@/components/community-gender-badge";

type Tab = "posts" | "comments";

export default function CommunityProfilePage() {
  const { username } = useParams<{ username: string }>();
  // myProfile (not `profile`, already the name of this page's *viewed* community
  // profile state below) carries the logged-in viewer's own communityProfileId —
  // "is this my own profile" must compare against that, never against user.id,
  // which is the real account id and no longer what a community response returns.
  const { profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<CommunityProfileResponse | null>(null);
  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [comments, setComments] = useState<CommunityCommentResponse[]>([]);
  const [tab, setTab] = useState<Tab>("posts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    communityApi
      .getProfile(username)
      .then((res) => {
        setProfile(res);
        return Promise.all([
          communityApi.postsByAuthor(res.communityProfileId, 0, 20),
          communityApi.commentsByAuthor(res.communityProfileId, 0, 20),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [postsRes, commentsRes] = results;
        setPosts(postsRes.content);
        setComments(commentsRes.content);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(load, [load]);

  function handlePostChanged(updated: CommunityPostResponse) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (loading) return <PageSpinner />;
  if (error || !profile) return <ErrorBanner message={error ?? "Community profile not found"} />;

  const isOwnProfile = myProfile?.communityProfileId === profile.communityProfileId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile.communityAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.communityAvatarUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${avatarColorClass(
                profile.communityUsername
              )}`}
            >
              {avatarInitials(profile.communityUsername)}
            </div>
          )}
          <div>
            <h1 className="flex items-center gap-1.5 font-display text-xl font-bold text-ink-900">
              u/{profile.communityUsername}
              <CommunityGenderBadge gender={profile.gender} className="h-5 min-w-5 text-xs" />
              {profile.verified && (
                <span title="Verified member" className="text-brand-600">
                  ✓
                </span>
              )}
            </h1>
            <p className="mt-0.5 text-sm text-ink-500">Member since {formatMonthYear(profile.memberSince)}</p>
            {isOwnProfile && (
              <Link href="/account" className="mt-0.5 inline-block text-xs font-medium text-crimson-700 hover:underline">
                Change avatar
              </Link>
            )}
            <p className="mt-1 text-xs text-ink-400">
              {profile.postCount} post{profile.postCount === 1 ? "" : "s"} · {profile.commentCount} comment
              {profile.commentCount === 1 ? "" : "s"} · {profile.reviewCount} review{profile.reviewCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 flex gap-3 text-xs">
              <Link href={`/community/u/${username}/following`} className="font-medium text-ink-600 hover:text-crimson-700 hover:underline">
                <span className="font-bold text-ink-900">{profile.followingCount}</span> Following
              </Link>
              <Link href={`/community/u/${username}/followers`} className="font-medium text-ink-600 hover:text-crimson-700 hover:underline">
                <span className="font-bold text-ink-900">{profile.followerCount}</span> Followers
              </Link>
            </p>
          </div>
        </div>
        {!isOwnProfile && (
          <FollowControl
            targetId={profile.communityProfileId}
            displayName={`u/${profile.communityUsername}`}
            following={profile.isFollowing}
            onFollowingChange={(following) => setProfile({ ...profile, isFollowing: following })}
          />
        )}
      </div>

      <div className="mt-6 flex gap-1 rounded-full bg-ink-50 p-1">
        {(["posts", "comments"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
              tab === t ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {tab === "posts" &&
          (posts.length === 0 ? (
            <EmptyState title="No posts yet" />
          ) : (
            posts.map((post) => (
              <CommunityPostCard key={post.id} post={post} onChanged={handlePostChanged} onDeleted={handlePostDeleted} />
            ))
          ))}

        {tab === "comments" &&
          (comments.length === 0 ? (
            <EmptyState title="No comments yet" />
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-ink-100 bg-surface p-4 shadow-card">
                <p className="whitespace-pre-wrap text-sm text-ink-700">{comment.content}</p>
                <p className="mt-2 text-xs text-ink-400">▲ {comment.score}</p>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
