"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { referenceApi } from "./api";
import { PAGE_SIZE } from "./config";
import { useUserLocation } from "./location-context";
import type { Area, BusinessSearchParams, Category, City } from "./types";

interface HomeSearchContextValue {
  params: BusinessSearchParams;
  setParams: (next: BusinessSearchParams) => void;
  locationStatus: "idle" | "locating" | "granted" | "denied";
  useMyLocation: () => void;
  categories: Category[];
  cities: City[];
  areas: Area[];
  cityId: string;
  setCityId: (id: string) => void;
}

const HomeSearchContext = createContext<HomeSearchContextValue | null>(null);

/**
 * Wraps the whole app (see layout.tsx) so the primary search bar can live
 * inside the persistent Navbar — rendered there only on the home page — while
 * the results grid and the secondary Price/Rating/Sort row stay in page.tsx,
 * both reading/writing this same state instead of two disconnected copies.
 */
export function HomeSearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<BusinessSearchParams>({ sort: "newest", page: 0, size: PAGE_SIZE });
  // Location itself now lives in the shared LocationProvider (lib/location-context.tsx) —
  // the Navbar's Near me button, the Browse location chip and every BusinessCard's distance
  // all read the same grant. This provider layers one thing on top just for its own "Near
  // me" button: re-sorting by distance, but only the one time *this* button caused a fresh
  // grant — a silent restore of a still-valid grant from a previous visit (or a grant made
  // via the Browse chip instead) shows distance on cards immediately but never silently
  // overrides whatever sort/filters this page session already has.
  const { status: sharedStatus, coords, request } = useUserLocation();
  const explicitRequestRef = useRef(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cityId, setCityId] = useState<string>("");

  useEffect(() => {
    if (!explicitRequestRef.current) return;
    if (sharedStatus === "granted" && coords) {
      explicitRequestRef.current = false;
      setParams((prev) => ({
        ...prev,
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: 5000,
        sort: "distance",
        page: 0,
      }));
    } else if (sharedStatus === "denied" || sharedStatus === "unavailable") {
      explicitRequestRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStatus, coords]);

  function useMyLocation() {
    explicitRequestRef.current = true;
    request();
  }

  const locationStatus: "idle" | "locating" | "granted" | "denied" =
    sharedStatus === "asking" ? "locating" : sharedStatus === "unavailable" ? "denied" : sharedStatus;

  useEffect(() => {
    referenceApi.categories().then(setCategories).catch(() => {});
    referenceApi
      .cities()
      .then((list) => {
        setCities(list);
        if (list.length > 0) setCityId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cityId) {
      setAreas([]);
      return;
    }
    referenceApi.areas(cityId).then(setAreas).catch(() => {});
  }, [cityId]);

  return (
    <HomeSearchContext.Provider
      value={{ params, setParams, locationStatus, useMyLocation, categories, cities, areas, cityId, setCityId }}
    >
      {children}
    </HomeSearchContext.Provider>
  );
}

export function useHomeSearch(): HomeSearchContextValue {
  const ctx = useContext(HomeSearchContext);
  if (!ctx) throw new Error("useHomeSearch must be used within HomeSearchProvider");
  return ctx;
}