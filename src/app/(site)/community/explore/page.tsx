"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { communityApi } from "@/lib/api";
import { useHomeSearch } from "@/lib/home-search-context";
import { selectableTopics, useCommunitySettings } from "@/lib/community-settings";
import { cn } from "@/lib/utils";
import type { CommunityPostResponse, CommunityPostType } from "@/lib/types";
import { CommunityPostCard } from "@/components/community-post-card";
import { EmptyState, PageSpinner } from "@/components/ui/misc";

/**
 * Discovery hub — reuses the existing feed (sort=TOP + postType filter) and
 * Nearby (tab=NEARBY + areaId) queries, no new backend or ranking logic.
 * Categories are the admin-managed topic list (GET /community/settings), same as the Home feed.s
 * dropdown already uses.
 */
export default function CommunityExplorePage() {
  return (
    <div className="pb-6 pt-0 lg:pt-6">
      <h1 className="font-display text-lg font-bold text-ink-900 lg:text-2xl">Explore</h1>
      <p className="mt-0.5 hidden text-sm text-ink-500 lg:block">
        Trending discussions, popular questions and reviews, and what's nearby.
      </p>

      <section className="mt-1.5 lg:mt-4">
        <CategoriesMenu />
      </section>

      <FeedSection title="Trending" seeAllHref="/community?sort=TOP" />
      <FeedSection title="Popular Questions" postType="QUESTION" seeAllHref="/community?postType=QUESTION" />
      <FeedSection title="Popular Reviews" postType="RECOMMENDATION" seeAllHref="/community?postType=RECOMMENDATION" />
      <NearbySection />
    </div>
  );
}

/** Category pills used to sit fully expanded (often wrapping 2-3 lines) — collapsed
 *  behind a single toggle button instead, matching the compact icon-first nav above it. */
function CategoriesMenu() {
  const [open, setOpen] = useState(false);
  const settings = useCommunitySettings();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150",
          open ? "border-ink-300 bg-ink-50 text-ink-900" : "border-ink-200 text-ink-700 hover:border-crimson-300 hover:text-crimson-700"
        )}
      >
        Categories
        <ChevronDown size={14} className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-64 animate-scale-in rounded-xl border border-ink-100 bg-surface p-2.5 shadow-pop"
        >
          <div className="flex flex-wrap gap-1.5">
            {selectableTopics(settings).map((t) => (
              <Link
                key={t.value}
                href={`/community?topic=${t.value}`}
                onClick={() => setOpen(false)}
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600 transition-colors duration-150 hover:border-crimson-300 hover:text-crimson-700"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedSection({ title, postType, seeAllHref }: { title: string; postType?: CommunityPostType; seeAllHref: string }) {
  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    communityApi
      .feed({ postType, sort: "TOP", size: 5 })
      .then((res) => setPosts(res.content))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [postType]);

  function handleChanged(updated: CommunityPostResponse) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <section className="mt-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink-900">{title}</h2>
        <Link href={seeAllHref} className="text-xs font-medium text-crimson-700 hover:underline">
          See all
        </Link>
      </div>
      <div className="mt-2">
        {loading && <PageSpinner />}
        {!loading && posts.length === 0 && <p className="text-sm text-ink-400">Nothing here yet.</p>}
        {!loading && posts.length > 0 && (
          <div className="divide-y divide-ink-100">
            {posts.map((post) => (
              <CommunityPostCard key={post.id} post={post} onChanged={handleChanged} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function NearbySection() {
  const { cities, areas, cityId, setCityId } = useHomeSearch();
  const [areaId, setAreaId] = useState("");
  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaId) {
      setPosts([]);
      return;
    }
    setLoading(true);
    communityApi
      .feed({ tab: "NEARBY", areaId, size: 10 })
      .then((res) => setPosts(res.content))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [areaId]);

  function handleChanged(updated: CommunityPostResponse) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <section id="nearby" className="mt-3 scroll-mt-24">
      <h2 className="font-display text-base font-bold text-ink-900">Nearby</h2>
      <div className="mt-2 flex gap-2">
        <select
          value={cityId}
          onChange={(e) => {
            setCityId(e.target.value);
            setAreaId("");
          }}
          className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-crimson-500/30"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-crimson-500/30"
        >
          <option value="">Choose an area…</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        {!areaId && <EmptyState title="Choose an area" description="Pick a city and area above to see nearby posts." />}
        {areaId && loading && <PageSpinner />}
        {areaId && !loading && posts.length === 0 && (
          <EmptyState title="No nearby content available" description="No posts near you yet — be the first to share something local." />
        )}
        {areaId && !loading && posts.length > 0 && (
          <div className="divide-y divide-ink-100">
            {posts.map((post) => (
              <CommunityPostCard key={post.id} post={post} onChanged={handleChanged} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
