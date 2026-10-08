"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referenceApi, reviewApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Area, City } from "@/lib/types";

interface RecentBusiness {
  id: string;
  name: string;
  slug: string;
}

/**
 * Home page "explore" section — city tabs → areas in that city, plus a
 * recently-reviewed-businesses list. Everything comes from real reference
 * data/endpoints (no keyword-search history exists on this platform, unlike
 * Yelp's "popular searches," so this adapts the same tabs+columns layout to
 * data Jachai actually has).
 */
export function ExploreCities({ onSelectArea }: { onSelectArea: (area: Area) => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [recentBusinesses, setRecentBusinesses] = useState<RecentBusiness[]>([]);

  useEffect(() => {
    referenceApi
      .cities()
      .then((list) => {
        setCities(list);
        if (list.length > 0) setActiveCityId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeCityId) return;
    let cancelled = false;
    setLoadingAreas(true);
    referenceApi
      .areas(activeCityId)
      .then((list) => !cancelled && setAreas(list))
      .catch(() => !cancelled && setAreas([]))
      .finally(() => !cancelled && setLoadingAreas(false));
    return () => {
      cancelled = true;
    };
  }, [activeCityId]);

  useEffect(() => {
    reviewApi
      .recent(0, 8)
      .then((res) => {
        const seen = new Set<string>();
        const businesses: RecentBusiness[] = [];
        for (const item of res.content) {
          if (!item.businessName || !item.businessSlug || seen.has(item.businessId)) continue;
          seen.add(item.businessId);
          businesses.push({ id: item.businessId, name: item.businessName, slug: item.businessSlug });
        }
        setRecentBusinesses(businesses.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  if (cities.length === 0) return null;
  const activeCity = cities.find((c) => c.id === activeCityId) ?? null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-900 mb-1">
        Explore areas in popular cities
      </h2>
      <p className="text-sm text-ink-500 mb-5">Browse verified businesses by area</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {cities.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCityId(c.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors",
              c.id === activeCityId
                ? "bg-crimson-600 border-crimson-600 text-white"
                : "border-ink-200 text-ink-600 hover:border-crimson-300 hover:text-crimson-700"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {activeCity && (
        <div>
          <h3 className="text-sm font-bold text-ink-800 mb-3">Areas in {activeCity.name}</h3>
          {loadingAreas ? (
            <p className="text-sm text-ink-400">Loading…</p>
          ) : areas.length === 0 ? (
            <p className="text-sm text-ink-400">No areas listed yet for {activeCity.name}.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectArea(a)}
                  className="text-left text-sm text-ink-600 hover:text-crimson-700 hover:underline truncate"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {recentBusinesses.length > 0 && (
        <div className="mt-8 pt-6 border-t border-ink-100">
          <h3 className="text-sm font-bold text-ink-800 mb-3">Recently reviewed businesses</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
            {recentBusinesses.map((b) => (
              <Link
                key={b.id}
                href={`/business/${b.slug}`}
                className="text-sm text-ink-600 hover:text-crimson-700 hover:underline truncate"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
