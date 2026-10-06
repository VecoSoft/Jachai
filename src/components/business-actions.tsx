"use client";

import { MessageCircle, Navigation, Phone } from "lucide-react";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import { BookmarkButton } from "./bookmark-button";

const tileClass = cn(
  "flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-ink-700 hover:bg-ink-50 disabled:cursor-default disabled:opacity-40 dark:text-ink-300 dark:hover:bg-ink-800",
  interactiveTransition,
  focusRing
);
const iconCircleClass = "flex size-10 items-center justify-center rounded-full bg-ink-100 dark:bg-ink-800";

/**
 * Google-Maps-place-sheet-style 4-up row: Call / Directions / Message / Save.
 * Replaces the old Bookmark+Share+Report text-button row — Share and Report
 * moved into the header's ⋯ menu (they're occasional actions, not primary
 * ones; see the header menu next to this in page.tsx).
 */
export function BusinessActions({
  businessId,
  contactNumber,
  latitude,
  longitude,
  onMessageClick,
}: {
  businessId: string;
  contactNumber: string;
  latitude: number;
  longitude: number;
  /** Omitted when owner chat is switched off (admin feature flag) — the Message tile hides. */
  onMessageClick?: () => void;
}) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="flex items-stretch gap-1 rounded-xl border border-ink-100 bg-surface p-1 dark:border-ink-700">
      {contactNumber ? (
        <a href={`tel:${contactNumber}`} className={tileClass}>
          <span className={iconCircleClass}>
            <Phone size={22} strokeWidth={1.75} />
          </span>
          <span className="text-xs font-medium">Call</span>
        </a>
      ) : (
        <span className={cn(tileClass, "pointer-events-none opacity-40")} aria-hidden="true">
          <span className={iconCircleClass}>
            <Phone size={22} strokeWidth={1.75} />
          </span>
          <span className="text-xs font-medium">Call</span>
        </span>
      )}

      <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={tileClass}>
        <span className={iconCircleClass}>
          <Navigation size={22} strokeWidth={1.75} />
        </span>
        <span className="text-xs font-medium">Directions</span>
      </a>

      {onMessageClick && (
        <button type="button" onClick={onMessageClick} className={tileClass}>
          <span className={iconCircleClass}>
            <MessageCircle size={22} strokeWidth={1.75} />
          </span>
          <span className="text-xs font-medium">Message</span>
        </button>
      )}

      <BookmarkButton businessId={businessId} tile />
    </div>
  );
}
