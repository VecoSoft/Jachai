"use client";

import { useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";

const chipBase = cn(
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
  interactiveTransition,
  focusRing
);

function LocationHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="location-help-heading">
      <div className="p-5 sm:p-6">
        <h2 id="location-help-heading" className="font-display text-lg font-bold text-ink-900 dark:text-ink-100">
          Turn on location to see distance
        </h2>
        <div className="mt-4 space-y-4 text-sm text-ink-600 dark:text-ink-300">
          <div>
            <p className="font-semibold text-ink-800 dark:text-ink-100">Chrome</p>
            <p className="mt-1">
              Tap the lock/info icon in the address bar → Site settings → Location → Allow. Then reload the page.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink-800 dark:text-ink-100">Safari</p>
            <p className="mt-1">
              Settings → Privacy & Security → Location Services must be on, then Settings → Safari Websites →
              Location → Allow.
            </p>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The single "show distance" control — used on the Browse grid and anywhere else a
 * caller wants it (see app/page.tsx). Deliberately prop-driven rather than reading
 * lib/location-context itself: the caller decides what "request" means (Home page's
 * request also auto-selects the Nearest sort — see home-search-context.tsx — a plain
 * useUserLocation().request() has no opinion about sort at all), matching how
 * business-filters.tsx's onUseMyLocation/locationStatus are already threaded as props —
 * same 4-value status type as FiltersProps, so a page that already has one for its
 * filters (e.g. useHomeSearch()) can hand it straight to this component too.
 */
export function LocationChip({
  status,
  onRequest,
  onClear,
  className,
}: {
  status: "idle" | "locating" | "granted" | "denied";
  onRequest: () => void;
  onClear: () => void;
  className?: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  if (status === "granted") {
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <span className={cn(chipBase, "border-crimson-200 bg-crimson-50 text-crimson-700 dark:border-crimson-500/30 dark:bg-crimson-500/10 dark:text-crimson-400")}>
          <MapPin size={16} strokeWidth={1.75} />
          Near you · on
          <button
            type="button"
            onClick={onClear}
            aria-label="Turn off distance"
            className={cn("-mr-1 ml-0.5 flex size-6 items-center justify-center rounded-full hover:bg-crimson-100 dark:hover:bg-crimson-500/20", focusRing)}
          >
            <X size={14} />
          </button>
        </span>
      </div>
    );
  }

  if (status === "locating") {
    return (
      <span className={cn(chipBase, "border-ink-200 text-ink-500 dark:border-ink-700", className)}>
        <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
        Finding you…
      </span>
    );
  }

  if (status === "denied") {
    return (
      <div className={cn("flex flex-col items-start gap-1", className)}>
        <span className={cn(chipBase, "border-ink-200 text-ink-500 dark:border-ink-700")}>
          <MapPin size={16} strokeWidth={1.75} />
          Location off
        </span>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className={cn("text-xs text-ink-400 underline decoration-ink-300 hover:text-ink-600", focusRing)}
        >
          Allow location in your browser settings to see distance
        </button>
        <LocationHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRequest}
      className={cn(chipBase, "border-ink-200 text-ink-700 hover:border-crimson-300 hover:text-crimson-700 dark:border-ink-700 dark:text-ink-300", className)}
    >
      <MapPin size={16} strokeWidth={1.75} />
      Show distance
    </button>
  );
}
