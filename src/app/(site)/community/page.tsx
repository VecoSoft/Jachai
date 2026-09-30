"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { useUserLocation } from "@/lib/location-context";
import { hiddenAds } from "@/lib/promo-session";
import { cn } from "@/lib/utils";
import { COMMUNITY_FEED_TYPE_FILTERS, COMMUNITY_SORT_OPTIONS } from "@/lib/community-constants";
import { selectableTopics, useCommunitySettings } from "@/lib/community-settings";
import type { CommunityPostResponse, CommunityPostType, CommunitySortOrder, CommunityTopic } from "@/lib/types";
import { CommunityComposer } from "@/components/community-composer";
import { CommunityPostCard } from "@/components/community-post-card";
import { EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

/**
 * The Community "Home" feed — the site nav / sidebar's default destination.
 * Following/Nearby moved out to their own pages (see app/(site)/community/
 * {following,followers,explore}) — this page only owns the type/category/
 * sort filters over the plain recent-or-top feed. `postType` reads its
 * initial value from the URL so sidebar links like `?postType=QUESTION`
 * (Questions/Reviews) land pre-filtered.
 */
export default function CommunityPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CommunityPageInner />
    </Suspense>
  );
}

function CommunityPageInner() {
  const { show } = useToast();
  const { user, profile } = useAuth();
  const { openModal: openUsernameModal } = useCommunityUsernameModal();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Type filtering (Questions/Reviews/Discussions) now lives only in the sidebar (see
  // CommunitySidebar) — no in-page pill duplicating it. postType is derived straight from
  // the URL on every render (not useState) so a sidebar link like `?postType=QUESTION`
  // re-filters even when it's a client-side navigation onto an already-mounted page —
  // a `useState(() => searchParams...)` initializer here would only run once on mount
  // and silently ignore every later query-param change.
  const postType = (searchParams.get("postType") as CommunityPostType | null) ?? null;
  const [topic, setTopic] = useState<CommunityTopic | null>(() => (searchParams.get("topic") as CommunityTopic | null) ?? null);
  const [sort, setSort] = useState<CommunitySortOrder>("NEW");
  const promptedForUsername = useRef(false);
  const settings = useCommunitySettings();

  // "When a user first enters Community, if they do not yet have a Community
  // username" — show the setup modal proactively, not just when they try to post/comment.
  useEffect(() => {
    if (!promptedForUsername.current && user && profile && !profile.communityUsername) {
      promptedForUsername.current = true;
      openUsernameModal();
    }
  }, [user, profile, openUsernameModal]);

  // Sponsored-slot targeting only uses location the viewer already granted (never prompts here).
  const { status: locationStatus, coords } = useUserLocation();
  const viewerLat = locationStatus === "granted" && coords ? Math.round(coords.lat * 1000) / 1000 : undefined;
  const viewerLng = locationStatus === "granted" && coords ? Math.round(coords.lng * 1000) / 1000 : undefined;

  const withoutHiddenAds = useCallback((list: CommunityPostResponse[]) => {
    const hidden = hiddenAds();
    return list.filter((p) => !p.sponsored || !hidden.has(p.sponsored.boostId));
  }, []);

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    setError(null);
    communityApi
      .feed({ topic: topic ?? undefined, postType: postType ?? undefined, sort, page: 0, lat: viewerLat, lng: viewerLng })
      .then((res) => {
        setPosts(withoutHiddenAds(res.content));
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [topic, postType, sort, viewerLat, viewerLng, withoutHiddenAds]);

  useEffect(loadFirstPage, [loadFirstPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await communityApi.feed({
        topic: topic ?? undefined,
        postType: postType ?? undefined,
        sort,
        page: page + 1,
        lat: viewerLat,
        lng: viewerLng,
      });
      setPosts((prev) => [...prev, ...withoutHiddenAds(res.content)]);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePosted(post: CommunityPostResponse) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleChanged(updated: CommunityPostResponse) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  const activeTypeLabel = COMMUNITY_FEED_TYPE_FILTERS.find((t) => t.value === postType)?.label;

  return (
    <div className="pb-6 pt-0 lg:pt-6">
      <h1 className="font-display text-lg font-bold text-ink-900 lg:text-2xl">
        {activeTypeLabel && activeTypeLabel !== "All" ? activeTypeLabel : "Jachai Community"}
      </h1>
      <p className="mt-0.5 hidden text-sm text-ink-500 lg:block">
        Local discussions, questions, and recommendations — under a Community username, not your account name.
      </p>

      <div className="mt-1.5 flex items-center justify-between gap-2 lg:mt-4">
        <div className="flex gap-1.5">
          {COMMUNITY_SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                sort === s.value ? "bg-crimson-50 text-crimson-700" : "text-ink-400 hover:text-ink-700"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={topic ?? ""}
          onChange={(e) => setTopic(e.target.value === "" ? null : (e.target.value as CommunityTopic))}
          className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-xs font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-crimson-500/30"
        >
          <option value="">All categories</option>
          {selectableTopics(settings).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <CommunityComposer onPosted={handlePosted} />
      </div>

      <div className="mt-4">
        {loading && <PageSpinner />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && posts.length === 0 && (
          <EmptyState title="No posts yet" description="Be the first to start a discussion." />
        )}
        {!loading && !error && posts.length > 0 && (
          <div className="divide-y divide-ink-100">
            {posts.map((post, i) => (
              <CommunityPostCard
                // A sponsored copy can sit beside the same post's organic copy — key them apart.
                key={post.sponsored ? `sponsored-${post.sponsored.boostId}-${i}` : post.id}
                post={post}
                onChanged={handleChanged}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}

        {!loading && !error && page + 1 < totalPages && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={loadMore} loading={loadingMore}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
