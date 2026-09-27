"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type LocationStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

export interface Coords {
  lat: number;
  lng: number;
}

interface StoredLocation extends Coords {
  timestamp: number;
}

interface LocationContextValue {
  status: LocationStatus;
  coords: Coords | null;
  /** Prompts for (or silently re-reads, if already granted) the browser's location. */
  request: () => void;
  clear: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const STORAGE_KEY = "jachai.location";
/** How long a stored fix stays good enough to reuse without asking the OS for a new one. */
const STORED_MAX_AGE_MS = 30 * 60_000;
/** Passed to getCurrentPosition — how old an OS-level position fix it may hand back as-is. */
const OS_MAX_AGE_MS = 10 * 60_000;

function readStored(): StoredLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number" || typeof parsed?.timestamp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(coords: Coords) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...coords, timestamp: Date.now() }));
  } catch {
    // best-effort — a full/blocked localStorage just means no persistence across refresh
  }
}

function clearStored() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Single source of truth for "where is the visitor", shared by the Navbar's Near me
 * button, the Browse location chip, and every BusinessCard's distance — one grant
 * anywhere makes distance show up everywhere (see home-search-context.tsx, which
 * layers its own "also sort by distance" behavior on top of this for the Near me
 * button specifically). Never calls navigator.geolocation on mount on its own —
 * the only mount-time exception is a silent *refresh* of an already-expired fix,
 * and only when the Permissions API confirms the user granted access in a past visit,
 * so that never surfaces a new browser consent prompt either.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);

  const requestPosition = useCallback((silent: boolean) => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (!silent) setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeStored(next);
        setCoords(next);
        setStatus("granted");
      },
      () => {
        // A failed *silent* refresh just leaves whatever (possibly stale) coords were
        // already showing rather than surfacing an error for a check the user didn't ask for.
        if (!silent) setStatus("denied");
      },
      { enableHighAccuracy: false, maximumAge: OS_MAX_AGE_MS, timeout: 10_000 }
    );
  }, []);

  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    if (Date.now() - stored.timestamp < STORED_MAX_AGE_MS) {
      setCoords({ lat: stored.lat, lng: stored.lng });
      setStatus("granted");
      return;
    }
    // Stale — only auto-refresh (no visible prompt) when permission is already granted.
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") requestPosition(true);
      })
      .catch(() => {});
  }, [requestPosition]);

  const request = useCallback(() => requestPosition(false), [requestPosition]);

  const clear = useCallback(() => {
    clearStored();
    setCoords(null);
    setStatus("idle");
  }, []);

  return <LocationContext.Provider value={{ status, coords, request, clear }}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation must be used within LocationProvider");
  return ctx;
}
