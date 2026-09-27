"use client";

import type { BusinessResponse } from "@/lib/types";
import { BusinessCard } from "./business-card";

/**
 * Horizontal snap-scroll row of BusinessCards — the same recipe reused for
 * Trending/Most-loved on the home page, and Similar businesses on the
 * business detail page and Saved/Bookmarks (all three previously hand-rolled
 * their own copy of this strip; see BusinessCard's own doc comment for why
 * there's now just the one card component too). No per-card badge here —
 * the section title itself already says "Trending"/"Most loved"/etc.
 */
export function BusinessCarousel({
  title,
  businesses,
}: {
  title: string;
  businesses: BusinessResponse[];
}) {
  if (businesses.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-semibold text-ink-900 sm:text-xl">{title}</h2>
      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {businesses.map((b) => (
          <div key={b.id} className="w-[44vw] max-w-[180px] shrink-0 snap-start md:w-[220px] md:max-w-none">
            <BusinessCard business={b} variant="carousel" />
          </div>
        ))}
      </div>
    </div>
  );
}
