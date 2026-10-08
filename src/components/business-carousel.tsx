"use client";

import type { ReactNode } from "react";
import type { BusinessResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BusinessCard } from "./business-card";

/**
 * One carousel card = exactly one "Browse businesses" grid column at every breakpoint
 * (grid-cols-2 gap-3 → sm gap-4 → md 3 cols → lg 4 → xl 5, see app/page.tsx). Percentages
 * resolve against the scroller's content box, which is the same width as the grid's
 * container, so a card is pixel-identical in both places.
 */
export const CAROUSEL_ITEM_WIDTH =
  "w-[calc((100%-12px)/2)] sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] xl:w-[calc((100%-64px)/5)]";

/**
 * Snap-scrolling strip. `bleed` runs it into the page's side padding (px-4 / sm:px-6 / lg:px-8)
 * so the next card peeks in at the edge; card widths are unaffected because the padding is
 * added back on the inside.
 */
export function CarouselStrip({ children, bleed = false, className }: { children: ReactNode; bleed?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        bleed && "-mx-4 scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Horizontal row of the same BusinessCard the Browse grid uses — Trending/Most loved on the
 * home page, Similar businesses on the business page. No per-card badge beyond the card's own:
 * the section title already says "Trending"/"Most loved"/etc.
 */
export function BusinessCarousel({
  title,
  businesses,
  bleed = false,
  itemWidthClassName = CAROUSEL_ITEM_WIDTH,
}: {
  title: string;
  businesses: BusinessResponse[];
  /** Override for narrower layouts (e.g. the business page sidebar); defaults to one Browse column. */
  itemWidthClassName?: string;
  /** Home page: let the strip run into the page padding so the next card peeks in. */
  bleed?: boolean;
}) {
  if (businesses.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-semibold text-ink-900 sm:text-xl">{title}</h2>
      <CarouselStrip bleed={bleed}>
        {businesses.map((b) => (
          <div key={b.id} className={cn("shrink-0 snap-start", itemWidthClassName)}>
            <BusinessCard business={b} />
          </div>
        ))}
      </CarouselStrip>
    </div>
  );
}
