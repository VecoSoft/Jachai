"use client";

import { useEffect, useRef, useState } from "react";
import { PRICE_TIER_LABELS, SORT_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Area, BusinessSearchParams, Category, City, PriceTier, SortOption } from "@/lib/types";
import { MobileFilters } from "./business-filters-mobile";
import { TabletFilters } from "./business-filters-tablet";
import { SmartSearchBar } from "./smart-search-bar";

export interface DropdownOption<T> {
  value: T | undefined;
  label: string;
}

// A single-select popover pill: shows "Label" when nothing is chosen and
// "Label: <choice>" once it is, so the active filter stays visible without
// needing a whole row of chips. Used by the desktop primary card and the
// tablet "Filters" popover.
export function FilterDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  highlightWhenSet = true,
  variant = "pill",
  triggerClassName,
}: {
  label: string;
  value: T | undefined;
  options: DropdownOption<T>[];
  onChange: (value: T | undefined) => void;
  /** Sort isn't a filter (it doesn't narrow results), so it stays neutrally
   * styled even once a non-default value is picked, unlike Price/Rating. */
  highlightWhenSet?: boolean;
  /** "pill" (default): bordered white button — used in the mobile/tablet filter
   *  sheets. "flat": no border or background at all, just "Label ▾" — used for
   *  the Navbar's inline search controls, which supply their own text color
   *  via triggerClassName since the Navbar can be transparent-over-photo. */
  variant?: "pill" | "flat";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasValue = value !== undefined;
  const active = highlightWhenSet && hasValue;
  const activeLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "flat"
            ? cn(
                "h-9 inline-flex items-center gap-1 px-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10",
                triggerClassName
              )
            : cn(
                "h-10 inline-flex items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "border-crimson-300 bg-crimson-50 text-crimson-700"
                  : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300"
              )
        }
      >
        {hasValue ? `${label}: ${activeLabel}` : label}
        <svg
          viewBox="0 0 20 20"
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 min-w-[190px] rounded-xl border border-ink-100 bg-surface p-1.5 shadow-pop">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                opt.value === value ? "bg-crimson-50 text-crimson-700 font-medium" : "text-ink-700 hover:bg-ink-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A single option pill for the mobile bottom sheet / tablet popover, where
// choices are laid out flat instead of behind a popover trigger.
export function FilterOptionPill<T extends string | number>({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-3.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-crimson-600 border-crimson-600 text-white"
          : "bg-surface border-ink-200 text-ink-700 hover:border-crimson-300 hover:text-crimson-700"
      )}
    >
      {children}
    </button>
  );
}

// Every control in the primary search row shares this height so selects and the
// "Near me" button line up pixel-for-pixel regardless of native rendering differences.
// min-h- (not h-), matching the 44px touch-target minimum — content still centers fine.
export const searchRowControl = "min-h-11 rounded-full px-4";

export const PRICE_OPTIONS: DropdownOption<PriceTier>[] = [
  { value: undefined, label: "Any price" },
  ...(Object.entries(PRICE_TIER_LABELS) as [PriceTier, string][]).map(([value, label]) => ({ value, label })),
];

export const RATING_OPTIONS: DropdownOption<number>[] = [
  { value: undefined, label: "Any rating" },
  { value: 4.5, label: "4.5+ ★" },
  { value: 4, label: "4+ ★" },
  { value: 3.5, label: "3.5+ ★" },
  { value: 3, label: "3+ ★" },
];

export const SORT_OPTIONS: DropdownOption<SortOption>[] = (Object.entries(SORT_LABELS) as [SortOption, string][]).map(
  ([value, label]) => ({ value, label })
);

export interface FiltersProps {
  value: BusinessSearchParams;
  onChange: (next: BusinessSearchParams) => void;
  onUseMyLocation: () => void;
  locationStatus: "idle" | "locating" | "granted" | "denied";
  /** Scrolls to the results grid — used by the mobile primary "Search" button
   * (search itself is already live/reactive; this just gets the user there). */
  onSearch: () => void;
}

export interface LocationData {
  categories: Category[];
  cities: City[];
  areas: Area[];
  cityId: string;
  setCityId: (id: string) => void;
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.3" fill={filled ? "white" : "none"} />
    </svg>
  );
}

// The Navbar's inline search (home page, lg+): a plain white rounded search
// bar — free-text query + a static "current city" location field (this app
// is Dhaka-only in practice, so the location field is a display, not a real
// filter) — plus a red submit button, and a separate plain "Near me" text
// link. Category selection lives in the hero's CategoryQuickNav tab row
// instead of a dropdown here; Price/Rating moved to a refine row by the
// results grid (see app/page.tsx). `light` controls the "Near me" text color
// since the Navbar can be transparent-over-photo (white) or solid (dark).
export function PrimarySearchBar({
  query,
  onSearch,
  onUseMyLocation,
  locationStatus,
  cityLabel = "Dhaka, Bangladesh",
  light,
  className,
}: {
  /** The committed search text (shared home-search state). */
  query: string;
  /** Runs a search for `q` — Enter, the submit button, or a picked suggestion. */
  onSearch: (q: string) => void;
  onUseMyLocation: () => void;
  locationStatus: "idle" | "locating" | "granted" | "denied";
  cityLabel?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2 xl:gap-4", className)}>
      <SmartSearchBar
        value={query}
        onSubmit={onSearch}
        className="max-w-[480px] flex-1"
        formClassName="flex min-w-0 items-stretch overflow-hidden rounded-md bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] focus-within:ring-2 focus-within:ring-crimson-300"
        trailing={
          <>
            <span className="my-2 w-px shrink-0 bg-ink-200" />
            <div className="hidden w-[180px] shrink-0 items-center gap-1.5 px-3 text-ink-500 xl:flex">
              <PinIcon filled={false} />
              <span className="truncate text-base">{cityLabel}</span>
            </div>
          </>
        }
      />

      <button
        type="button"
        onClick={onUseMyLocation}
        disabled={locationStatus === "locating"}
        aria-label={locationStatus === "granted" ? "Using location" : "Near me"}
        title={locationStatus === "granted" ? "Using location" : "Near me"}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 xl:px-3 py-2.5 text-base font-semibold whitespace-nowrap transition-colors disabled:opacity-70 disabled:cursor-wait",
          light ? "text-white hover:bg-white/15" : "text-ink-700 hover:bg-ink-100"
        )}
      >
        {locationStatus === "locating" ? (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <PinIcon filled={locationStatus === "granted"} />
        )}
        <span className="hidden xl:inline">{locationStatus === "granted" ? "Using location" : "Near me"}</span>
      </button>
    </div>
  );
}

export function BusinessFilters(props: FiltersProps & LocationData) {
  return (
    <>
      <div className="md:hidden">
        <MobileFilters {...props} />
      </div>
      <div className="hidden md:block lg:hidden">
        <TabletFilters {...props} />
      </div>
    </>
  );
}