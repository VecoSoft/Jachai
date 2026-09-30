"use client";

import type { ReactNode } from "react";
import { Info, LocateFixed, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { SmartSearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function Chip({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        muted
          ? "border-dashed border-ink-200 text-ink-400"
          : "border-ink-200 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
      )}
    >
      {children}
    </span>
  );
}

/**
 * Above the results of a text search: how the query was understood (so users can see "kom dami
 * biriyani near mirpur" became Biryani · Mirpur · Budget), any typo fix, an honest notice when a
 * constraint had to be relaxed, and — only when the query itself said "near me" — a consent-based
 * prompt to share location. Nothing here requests location on its own.
 */
export function SearchUnderstanding({
  query,
  meta,
  locationStatus,
  onUseMyLocation,
  onClear,
  onSearch,
}: {
  query: string;
  meta: Omit<SmartSearchResponse, "results">;
  locationStatus: "idle" | "locating" | "granted" | "denied";
  onUseMyLocation: () => void;
  onClear: () => void;
  onSearch: (q: string) => void;
}) {
  const { t } = useLanguage();
  const { intent, notice, needsLocation } = meta;

  const chips: ReactNode[] = [];
  intent.what.forEach((w) =>
    chips.push(
      <Chip key={`w:${w.label}`}>
        <span aria-hidden>{w.icon}</span>
        {w.label}
      </Chip>
    )
  );
  intent.keywords.forEach((k) => chips.push(<Chip key={`k:${k}`}>“{k}”</Chip>));
  if (intent.location) {
    chips.push(
      <Chip key="loc" muted={!intent.locationKnown}>
        <span aria-hidden>📍</span>
        {intent.location}
        {!intent.locationKnown && <span>· {t("search.no_listings_there")}</span>}
      </Chip>
    );
  }
  if (intent.nearMe) chips.push(<Chip key="near"><span aria-hidden>📍</span>{t("search.near_me")}</Chip>);
  if (intent.price) {
    chips.push(
      <Chip key="price">
        {intent.price === "LOW" ? `৳ ${t("search.price_low")}` : `৳৳৳ ${t("search.price_high")}`}
      </Chip>
    );
  }
  if (intent.ratingHigh) chips.push(<Chip key="rating">★ {t("search.top_rated")}</Chip>);
  if (intent.openNow) chips.push(<Chip key="open">{t("search.open_now")}</Chip>);

  const askForLocation = needsLocation && locationStatus !== "granted";

  return (
    <div className="mb-4 space-y-2.5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs font-medium text-ink-500">{t("search.understood")}</span>
        {chips.length > 0 ? chips : <Chip>“{query}”</Chip>}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        >
          <X aria-hidden size={12} />
          {t("search.clear")}
        </button>
      </div>

      {intent.correctedQuery && (
        <p className="text-sm text-ink-600">
          {t("search.corrected")}{" "}
          <button
            type="button"
            onClick={() => onSearch(intent.correctedQuery!)}
            className="font-semibold text-ink-900 underline decoration-ink-300 underline-offset-2 hover:decoration-crimson-500"
          >
            {intent.correctedQuery}
          </button>
        </p>
      )}

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {askForLocation && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <LocateFixed aria-hidden size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {locationStatus === "denied" ? t("search.location_denied") : t("search.location_needed")}
          </span>
          {locationStatus !== "denied" && (
            <button
              type="button"
              onClick={onUseMyLocation}
              disabled={locationStatus === "locating"}
              className="rounded-full bg-sky-700 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
            >
              {t("search.use_location")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
