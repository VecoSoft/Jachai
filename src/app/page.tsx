"use client";

import { useEffect, useRef, useState } from "react";
import { businessApi } from "@/lib/api";
import { rememberBusinesses } from "@/lib/business-cache";
import { useHomeSearch } from "@/lib/home-search-context";
import { useUserLocation } from "@/lib/location-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage } from "@/lib/toast-context";
import type { Area, BusinessResponse, Category, SearchSuggestion, SmartSearchResponse } from "@/lib/types";
import { BrandCard } from "@/components/brand-card";
import { BusinessCard } from "@/components/business-card";
import { BusinessCarousel } from "@/components/business-carousel";
import { BusinessFilters } from "@/components/business-filters";
import { CategoryQuickNav } from "@/components/category-quick-nav";
import { CategoriesGrid } from "@/components/categories-grid";
import { ExploreCities } from "@/components/explore-cities";
import { LocationChip } from "@/components/location-chip";
import { QuestionsForYouWidget } from "@/components/questions-for-you-widget";
import { Reveal } from "@/components/reveal";
import { SearchUnderstanding } from "@/components/search-understanding";
import { SmartSearchBar } from "@/components/smart-search-bar";
import { FeaturedNearby, SponsoredBusinessCard } from "@/components/promo/featured-nearby";
import { hiddenAds } from "@/lib/promo-session";
import { EmptyState, ErrorBanner, Pagination } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";

// Rotates every HERO_ROTATE_INTERVAL_MS — see the crossfade layers below.
const HERO_IMAGES = [
  "https://t3.ftcdn.net/jpg/08/87/43/12/360_F_887431211_oTMtoK4uDoTBYq57CjxkwNBzqExhPYfF.jpg",
  "https://c8.alamy.com/comp/2HTN8DN/car-auto-service-and-vehicle-maintenance-workshop-center-automobile-garage-shop-and-spare-part-changing-automotive-services-station-business-car-re-2HTN8DN.jpg",
  "https://alvarezandmarsal-crg.com/wp-content/uploads/2021/07/The-future-Image-Inactive@2x.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlKhRY6buGBK63OnPUWrFw9ja-5CWLgv4K3R2HarHgKg&s=10",
];
const HERO_ROTATE_INTERVAL_MS = 5000;

/** Same shape as the real grid BusinessCard (see components/business-card.tsx) at every
 *  width now that the grid is 2-5 columns throughout, not a different layout on mobile. */
function SkeletonCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
      <Skeleton className="aspect-square w-full md:aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
        <Skeleton className="h-2.5 w-2/3 rounded" />
        <Skeleton className="h-2.5 w-1/2 rounded" />
      </div>
    </div>
  );
}

export default function HomePage() {
  // Category/City/Area/Near-me now live in the Navbar (home page only) —
  // this page and the Navbar both read/write the same shared state instead
  // of keeping two disconnected copies. See lib/home-search-context.tsx.
  const {
    params,
    setParams,
    locationStatus,
    useMyLocation,
    categories,
    cities,
    areas,
    cityId,
    setCityId,
  } = useHomeSearch();
  const { clear: clearLocation, status: sharedLocationStatus, coords } = useUserLocation();
  const { t, lang } = useLanguage();

  const [results, setResults] = useState<BusinessResponse[]>([]);
  // Set only for text searches (smart search); plain browsing/filtering keeps using /businesses/search.
  const [smartMeta, setSmartMeta] = useState<Omit<SmartSearchResponse, "results"> | null>(null);
  const [popular, setPopular] = useState<SearchSuggestion[]>([]);
  // "Hide this ad" on the sponsored search result — also remembered for future searches.
  const [sponsoredHidden, setSponsoredHidden] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [trending, setTrending] = useState<BusinessResponse[]>([]);
  const [mostLoved, setMostLoved] = useState<BusinessResponse[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotates the hero background photo — the actual crossfade is pure CSS
  // (transition-opacity on stacked layers below), this just advances which
  // layer is "on top" every HERO_ROTATE_INTERVAL_MS. Explicitly clearing any
  // interval already sitting in heroTimerRef before starting a new one
  // guards against ever having two timers alive at once (e.g. React Strict
  // Mode's dev-only double-invoke, or a hot-reload) — that's what causes
  // rotations to suddenly speed up after the first one.
  useEffect(() => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, HERO_ROTATE_INTERVAL_MS);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    };
  }, []);

  // Seed the search from a footer/shared deep link (e.g. "/?categoryId=...")
  // once on mount — plain window.location instead of useSearchParams() so
  // this stays a single client component with no Suspense boundary needed.
  useEffect(() => {
    const url = new URL(window.location.href);
    const categoryId = url.searchParams.get("categoryId");
    const areaId = url.searchParams.get("areaId");
    if (!categoryId && !areaId) return;
    setParams({
      ...params,
      categoryId: categoryId ?? params.categoryId,
      areaId: areaId ?? params.areaId,
      page: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Text in the search box → smart search (intent, fallbacks, match reasons); otherwise the plain
  // filter search. Location is only *used* if already granted — searching never prompts for it.
  // Coords are rounded (~100 m) so GPS jitter doesn't trigger re-searches.
  const query = params.q?.trim() ?? "";
  const grantedLat = sharedLocationStatus === "granted" && coords ? Math.round(coords.lat * 1000) / 1000 : undefined;
  const grantedLng = sharedLocationStatus === "granted" && coords ? Math.round(coords.lng * 1000) / 1000 : undefined;
  const smartKey = query ? `${lang}|${grantedLat ?? ""}|${grantedLng ?? ""}` : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = query
      ? businessApi
          .smartSearch({
            q: query,
            categoryId: params.categoryId,
            areaId: params.areaId,
            priceTier: params.priceTier,
            minRating: params.minRating,
            lat: params.lat ?? grantedLat,
            lng: params.lng ?? grantedLng,
            sort: params.sort,
            page: params.page,
            size: params.size,
            lang,
          })
          .then(({ results: page, ...meta }) => ({ page, meta }))
      : businessApi.search(params).then((page) => ({ page, meta: null }));
    request
      .then(({ page, meta }) => {
        if (cancelled) return;
        setResults(page.content);
        setTotalPages(page.totalPages);
        setTotalElements(page.totalElements);
        setSmartMeta(meta);
        setSponsoredHidden(Boolean(meta?.sponsored && hiddenAds().has(meta.sponsored.boostId)));
        rememberBusinesses(page.content);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, smartKey]);

  // A new text search should bring its results into view (the box lives in the navbar/hero, far above the grid).
  const lastQueryRef = useRef(query);
  useEffect(() => {
    if (query && query !== lastQueryRef.current) scrollToResults();
    lastQueryRef.current = query;
  }, [query]);

  // Ideas to offer when a text search finds nothing — fetched lazily, only in that case.
  const noSmartResults = Boolean(query) && !loading && !error && results.length === 0;
  useEffect(() => {
    if (!noSmartResults) return;
    businessApi.searchSuggestions("", lang).then(setPopular).catch(() => setPopular([]));
  }, [noSmartResults, lang]);

  function runSearch(q: string) {
    setParams({ ...params, q, page: 0 });
  }

  // Sitewide, unfiltered by the search params above — a fixed top-10 snapshot
  // fetched once on mount, not re-fetched as the visitor changes filters.
  useEffect(() => {
    businessApi
      .search({ sort: "trending", size: 10 })
      .then((page) => setTrending(page.content))
      .catch(() => {});
    businessApi
      .search({ sort: "most_loved", size: 10 })
      .then((page) => setMostLoved(page.content))
      .catch(() => {});
  }, []);

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyCategory(category: Category) {
    setParams({ ...params, categoryId: category.id, page: 0 });
    scrollToResults();
  }

  // The hero's Yelp-style category quick-nav (see CategoryQuickNav) is a
  // curated frontend-only taxonomy, not the backend Category list — a tap
  // there becomes a free-text query (fuzzy business-name search already
  // backs `q`) instead of a strict categoryId filter, so it always returns
  // something reasonable regardless of exact admin-seeded category names.
  function applyCategoryNavQuery(query: string) {
    setParams({ ...params, q: query, categoryId: undefined, page: 0 });
    scrollToResults();
  }

  function applyArea(area: Area) {
    setParams({ ...params, areaId: area.id, page: 0 });
    scrollToResults();
  }

  return (
    <>
      {/* Hero: the primary Category/City/Area/Near-me search now lives up in
          the Navbar itself (see components/navbar.tsx) — this section is just
          the quieter Price/Rating/Sort refine row, a category quick-nav strip,
          and a clean full-bleed photo with a headline underneath. */}
      <section className="relative w-full min-h-[480px] md:min-h-[640px] lg:min-h-screen overflow-hidden flex flex-col">
        {/* BackgroundImage — rotates through HERO_IMAGES every 5s. Every photo
            is stacked in the same spot; only the current one is opacity-100,
            and transition-opacity crossfades between them. animate-ken-burns
            restarts on each layer the moment it becomes the visible one. */}
        {HERO_IMAGES.map((url, i) => (
          <div
            key={url}
            // animate-ken-burns is unconditional (every layer, from mount) —
            // it must NEVER be toggled on/off in step with the opacity
            // crossfade, or the transform snaps back to scale(1) the instant
            // a layer becomes active, which reads as a jerky "kick" right as
            // it fades in. Only opacity animates on rotation; the zoom runs
            // completely independently underneath it, so the fade is smooth.
            className={`absolute inset-0 bg-cover bg-center animate-ken-burns transition-opacity duration-[1500ms] ease-in-out ${
              i === heroIndex ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${url})` }}
          />
        ))}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/70 via-scrim/30 to-scrim/10" />

        {/* mt-16 sits this flush under the fixed h-16 navbar. On lg+, the
            Navbar itself now carries the entire search (Category/City/Area/
            Price/Rating/Near-me — see components/navbar.tsx), so this strip
            only needs to render for mobile/tablet, which don't have room for
            an inline navbar search and still use their own bottom-sheet/
            popover — plus the category quick-nav strip, which stays lg+ only. */}
        <div className="relative z-20 mt-16 animate-hero-in">
          <div className="lg:hidden bg-scrim/90 backdrop-blur-md border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-1.5">
              {/* Same search box as the navbar's (lg+ only) — mobile/tablet had
                  dropdowns but no way to type a search at all. */}
              <SmartSearchBar
                value={params.q ?? ""}
                onSubmit={runSearch}
                placeholder={t("search.placeholder_short")}
                formClassName="flex min-w-0 items-stretch overflow-hidden rounded-xl bg-white focus-within:ring-2 focus-within:ring-crimson-300"
                inputClassName="py-2.5"
                submitClassName="w-12"
              />
              {/* Full self-contained mobile/tablet filter UI (bottom sheet /
                  popover) — unchanged. Below lg only; lg+ uses the Navbar's
                  inline search instead, so this whole div is lg:hidden above. */}
              <BusinessFilters
                value={params}
                onChange={setParams}
                onUseMyLocation={useMyLocation}
                locationStatus={locationStatus}
                onSearch={scrollToResults}
                categories={categories}
                cities={cities}
                areas={areas}
                cityId={cityId}
                setCityId={setCityId}
              />
            </div>
          </div>

          <CategoryQuickNav onSelect={applyCategoryNavQuery} />
        </div>

        {/* HeroContent — headline + single CTA, anchored toward the bottom of
            the photo (the search work now happens up in the navbar/strip above). */}
        <div className="relative z-10 flex-1 flex flex-col justify-end max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-14 md:pb-16 lg:pb-44">
          <h1
            className="max-w-2xl font-sans text-2xl md:text-3xl lg:text-5xl font-extrabold text-white leading-[1.15] md:leading-[1.12] tracking-tight drop-shadow-sm animate-hero-in"
            style={{ animationDelay: "150ms" }}
          >
            Find a business you can actually trust
          </h1>
          <p
            className="animate-hero-in mt-3 md:mt-10 text-white/90 text-sm md:text-base max-w-md leading-relaxed"
            style={{ animationDelay: "300ms" }}
          >
            Search verified local businesses across Dhaka — filtered by category, area, price,
            and rating, with owner verification you won&apos;t find on Google Maps or
            Facebook.
          </p>
          <button
            type="button"
            onClick={scrollToResults}
            style={{ animationDelay: "420ms" }}
            className="animate-hero-in mt-4 md:mt-5 w-fit inline-flex items-center gap-2.5 rounded-full bg-crimson-600 text-white font-semibold px-6 md:px-7 py-3 md:py-3.5 text-sm md:text-base shadow-lift transition-all duration-200 hover:bg-crimson-500 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-95"
          >

            Start exploring
          </button>
        </div>
      </section>

      {(trending.length > 0 || mostLoved.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {trending.length > 0 && (
            <Reveal>
              <BusinessCarousel title="Trending this week" businesses={trending} />
            </Reveal>
          )}
          {mostLoved.length > 0 && (
            <Reveal>
              <BusinessCarousel title="Most loved" businesses={mostLoved} />
            </Reveal>
          )}
        </div>
      )}

      {/* V58: paid, clearly labelled "Sponsored" carousel — renders nothing when no boost is eligible. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <FeaturedNearby />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-md py-4">
            <QuestionsForYouWidget limit={4} />
          </div>
        </Reveal>
      </div>

      {/* BusinessList: a distinct, "gorgeous" section — soft gradient wash +
          blurred color blobs (a subtle mesh-gradient look) behind the grid,
          instead of a flat white background. overflow-hidden clips the blobs
          to this section only; ref stays on the scroll-target wrapper. */}
        <div className="relative overflow-hidden via-crimson-50/40 to-white border-t border-ink-100">
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -right-24 h-80 w-80 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl" />
                <div ref={resultsRef} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
          <Reveal>
            <div className="text-center pt-2 mb-6">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-900">Browse businesses</h2>
              <span className="mt-2.5 mx-auto block h-1 w-16 rounded-full bg-gradient-to-r from-crimson-500 to-amber-400" />
            </div>
          </Reveal>

          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <LocationChip status={locationStatus} onRequest={useMyLocation} onClear={clearLocation} />
            {locationStatus === "granted" && params.sort === "distance" && (
              <span className="text-xs text-ink-400">Sorted by distance</span>
            )}
          </div>

          {loading && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
          {!loading && error && <ErrorBanner message={error} />}

          {!loading && !error && (
            <>
              {query && smartMeta && (
                <SearchUnderstanding
                  query={query}
                  meta={smartMeta}
                  locationStatus={locationStatus}
                  onUseMyLocation={useMyLocation}
                  onClear={() => runSearch("")}
                  onSearch={runSearch}
                />
              )}
              {/* V58: at most one sponsored result, pinned ABOVE the organic results (which stay
                  exactly as the search returned them) and always labelled. */}
              {query && smartMeta?.sponsored && !sponsoredHidden && (
                <div className="mb-5 max-w-xs">
                  <SponsoredBusinessCard item={smartMeta.sponsored} source="SEARCH" onHidden={() => setSponsoredHidden(true)} />
                </div>
              )}
              <p key={totalElements} className="animate-fade-in text-sm font-medium text-ink-500 mb-4">
                {totalElements} businesses found
              </p>
              {results.length === 0 ? (
                query ? (
                  <EmptyState
                    title={t("search.no_results_title", { q: query })}
                    description={t("search.no_results_desc")}
                    action={
                      popular.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                          {popular.map((s) => (
                            <button
                              key={s.query}
                              type="button"
                              onClick={() => runSearch(s.query)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-crimson-300 hover:text-crimson-700"
                            >
                              {s.icon && <span aria-hidden>{s.icon}</span>}
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )
                    }
                  />
                ) : (
                  <EmptyState
                    title="No businesses match those filters"
                    description="Try widening your area, dropping the minimum rating, or clearing a filter."
                  />
                )
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {results.map((b, i) => (
                    <Reveal key={b.id} delay={Math.min(i, 8) * 60}>
                      {b.branchCount && b.branchCount > 1 ? (
                        <BrandCard business={b} matchReasons={smartMeta?.matchReasons[b.id]} />
                      ) : (
                        <BusinessCard business={b} matchReasons={smartMeta?.matchReasons[b.id]} />
                      )}
                    </Reveal>
                  ))}
                </div>
              )}
              <Pagination
                page={params.page ?? 0}
                totalPages={totalPages}
                onChange={(page) => setParams({ ...params, page })}
              />
            </>
          )}
        </div>
      </div>

      <Reveal>
        <CategoriesGrid onSelect={applyCategory} />
      </Reveal>
      <Reveal>
        <ExploreCities onSelectArea={applyArea} />
      </Reveal>
    </>
  );
}