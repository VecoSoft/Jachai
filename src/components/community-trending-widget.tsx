"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowBigUp, MapPin, MessageCircle, TrendingUp } from "lucide-react";
import { communityApi } from "@/lib/api";
import type { CommunityPostResponse } from "@/lib/types";
import { Card } from "./ui/misc";

/**
 * Right-rail contextual widgets — kept deliberately small (per the redesign
 * brief: "do NOT overcrowd the right sidebar"). Trending reuses the existing
 * sort=TOP feed query (no new backend). "Near You" is a lightweight prompt
 * linking into Explore's Nearby section rather than its own data fetch — the
 * existing Nearby flow needs a picked city/area first, which doesn't fit a
 * compact rail widget.
 */
export function CommunityTrendingWidget({ className }: { className?: string }) {
  const [posts, setPosts] = useState<CommunityPostResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .feed({ sort: "TOP", size: 10 })
      // Member posts only — business posts appear (labelled) in the feed, never in this unlabelled rail.
      .then((res) => setPosts(res.content.filter((p) => !p.business).slice(0, 5)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-900">
          <TrendingUp size={15} className="text-crimson-600" />
          Trending Now
        </div>
        <div className="divide-y divide-ink-100">
          {loading && <p className="px-4 py-4 text-xs text-ink-400">Loading…</p>}
          {!loading && posts.length === 0 && <p className="px-4 py-4 text-xs text-ink-400">Nothing trending yet.</p>}
          {!loading &&
            posts.map((post, i) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="group flex items-start gap-2.5 px-4 py-3 transition-colors duration-150 hover:bg-ink-50"
              >
                <span className="w-4 shrink-0 pt-0.5 text-center font-display text-base font-extrabold leading-none text-ink-200 tabular-nums transition-colors duration-150 group-hover:text-crimson-300">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-800 group-hover:text-ink-900">
                    {post.title ?? post.body}
                  </p>
                  <span className="mt-1 flex items-center gap-2.5 text-[11px] font-medium text-ink-400">
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowBigUp size={12} className="shrink-0 text-crimson-500" /> {post.score}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle size={12} className="shrink-0" /> {post.commentCount}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-4">
        <Link href="/community/explore#nearby" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crimson-50 text-crimson-600 transition-colors duration-150 group-hover:bg-crimson-100">
            <MapPin size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink-900 group-hover:text-crimson-700">Near You</span>
            <span className="block text-xs text-ink-500">See what's happening in your area.</span>
          </span>
        </Link>
      </Card>
    </div>
  );
}
