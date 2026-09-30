"use client";

import { useEffect, useState } from "react";
import { communityApi } from "./api";
import { useAuth } from "./auth-context";
import { COMMUNITY_TOPIC_LABELS, COMMUNITY_TOPICS } from "./community-constants";
import type { CommunityPostType, CommunityPublicSettings, CommunityStanding, CommunityTopicInfo } from "./types";

/**
 * Admin-managed community configuration from GET /api/v1/community/settings — topics, enabled
 * post types, limits, rules text, maintenance/read-only flags and feature flags. The server
 * enforces every one of these; the app only mirrors them for UX, so an admin change shows up on
 * the next page view (30 s client cache) without a deploy.
 */
const TTL_MS = 30_000;
let cache: { value: CommunityPublicSettings; at: number } | null = null;
let inflight: Promise<CommunityPublicSettings> | null = null;

export function loadCommunitySettings(force = false): Promise<CommunityPublicSettings> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.value);
  if (!inflight) {
    inflight = communityApi
      .settings()
      .then((value) => {
        cache = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Null until the first load finishes — callers fall back to the built-in defaults meanwhile. */
export function useCommunitySettings(): CommunityPublicSettings | null {
  const [settings, setSettings] = useState<CommunityPublicSettings | null>(cache?.value ?? null);
  useEffect(() => {
    let alive = true;
    loadCommunitySettings()
      .then((value) => alive && setSettings(value))
      .catch(() => {
        // Settings are a UX mirror only — keep the defaults if the call fails.
      });
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}

/** Whether NID verification is on (admin feature flag). Off by default — every NID entry point hides. */
export function useNidVerificationEnabled(): boolean {
  return useCommunitySettings()?.features.nidVerificationEnabled ?? false;
}

/** Label for a topic code — admin label when known, else the built-in label, else the code itself. */
export function topicLabel(settings: CommunityPublicSettings | null, code: string): string {
  return settings?.topics.find((t) => t.code === code)?.label ?? COMMUNITY_TOPIC_LABELS[code] ?? code;
}

/** Topics a new post can use (enabled, admin order). Falls back to the built-in list before settings load. */
export function selectableTopics(settings: CommunityPublicSettings | null): { value: string; label: string }[] {
  if (!settings) return COMMUNITY_TOPICS;
  return settings.topics
    .filter((t: CommunityTopicInfo) => t.enabled)
    .sort((a, b) => a.position - b.position)
    .map((t) => ({ value: t.code, label: t.label }));
}

export function postTypeEnabled(settings: CommunityPublicSettings | null, type: CommunityPostType): boolean {
  return settings ? settings.postTypes[type] !== false : true;
}

/** Why the community can't be written to right now (maintenance / read-only), or null. */
export function communityWriteBlock(settings: CommunityPublicSettings | null): string | null {
  if (!settings) return null;
  if (!settings.communityEnabled) return settings.maintenanceMessage;
  if (settings.readOnly) return settings.readOnlyMessage;
  return null;
}

/**
 * The logged-in member's own standing (mute/suspend/ban + recent warnings). Null for guests or
 * while loading. `refresh` re-fetches (e.g. after a 403 from a write).
 */
export function useCommunityStanding(): { standing: CommunityStanding | null; refresh: () => void } {
  const { user } = useAuth();
  const [standing, setStanding] = useState<CommunityStanding | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!user) {
      setStanding(null);
      return;
    }
    let alive = true;
    communityApi
      .standing()
      .then((s) => alive && setStanding(s))
      .catch(() => alive && setStanding(null));
    return () => {
      alive = false;
    };
  }, [user, nonce]);
  return { standing, refresh: () => setNonce((n) => n + 1) };
}

const RESTRICTION_LABELS: Record<string, string> = {
  WARN: "You've received a warning",
  MUTE: "You're muted in the community",
  SUSPEND: "Your community access is suspended",
  BAN: "You're banned from the community",
};

export function restrictionTitle(type: string): string {
  return RESTRICTION_LABELS[type] ?? "Your community access is restricted";
}

export function formatRestrictionEnd(endsAt: string | null): string {
  if (!endsAt) return "permanently";
  return `until ${new Date(endsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}
