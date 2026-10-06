"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, BookOpen, ChevronDown, Clock, Lock, Megaphone, Pin, ShieldAlert, Sparkles, X } from "lucide-react";
import {
  formatRestrictionEnd,
  restrictionTitle,
  useCommunitySettings,
  useCommunityStanding,
} from "@/lib/community-settings";
import { cn } from "@/lib/utils";
import type { CommunityPostResponse, CommunityStanding } from "@/lib/types";
import { CommunityMarkdown } from "./community-markdown";
import { Badge } from "./ui/misc";

/**
 * Community-wide notices at the top of every /community page: maintenance or read-only mode
 * (admin setting) and the active "Jachai Team" announcement banner (dismissible per announcement,
 * remembered in this browser only).
 */
export function CommunityStatusBanner() {
  const settings = useCommunitySettings();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const bannerId = settings?.banner?.id ?? null;

  useEffect(() => {
    if (!bannerId) return;
    try {
      if (window.localStorage.getItem(`community-banner-dismissed:${bannerId}`)) setDismissedId(bannerId);
    } catch {
      // storage unavailable — the banner simply stays dismissible for this view
    }
  }, [bannerId]);

  if (!settings) return null;
  const showBanner = Boolean(settings.banner && dismissedId !== settings.banner.id);
  // Community switched off → CommunityGate renders the single full-page state instead.
  if (!settings.communityEnabled || (!settings.readOnly && !showBanner)) return null;

  function dismiss() {
    if (!bannerId) return;
    setDismissedId(bannerId);
    try {
      window.localStorage.setItem(`community-banner-dismissed:${bannerId}`, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-2">
      {settings.readOnly && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <p>{settings.readOnlyMessage}</p>
        </div>
      )}
      {showBanner && settings.banner && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Megaphone size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">
            <span className="font-semibold">Jachai Team · </span>
            {settings.banner.text}{" "}
            <Link href={`/community/${settings.banner.postId}`} className="font-semibold underline underline-offset-2">
              Read more
            </Link>
          </p>
          <button type="button" onClick={dismiss} aria-label="Dismiss announcement" className="rounded-full p-0.5 hover:bg-brand-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** "You're muted until …" — shown in place of the composer / comment box and on /account. */
export function CommunityRestrictionNotice({ standing, className }: { standing: CommunityStanding | null; className?: string }) {
  const r = standing?.restriction;
  if (!r) return null;
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700", className)}>
      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">
          {restrictionTitle(r.type)} {formatRestrictionEnd(r.endsAt)}.
        </p>
        <p className="mt-0.5">Reason: {r.reason}</p>
        <p className="mt-0.5 text-xs opacity-80">You can still read the community, but you can't post, comment or vote until then.</p>
      </div>
    </div>
  );
}

/**
 * /account notice: an active mute/suspend/ban (with reason + end date), or the most recent
 * warning from the last 30 days. Renders nothing for members in good standing.
 */
export function AccountCommunityNotice() {
  const { standing } = useCommunityStanding();
  if (!standing) return null;
  if (standing.restriction) {
    return <CommunityRestrictionNotice standing={standing} className="mb-4" />;
  }
  const warning = standing.items.find((i) => i.type === "WARN");
  if (!warning) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">You've received a community warning</p>
        <p className="mt-0.5">Reason: {warning.reason}</p>
        <p className="mt-0.5 text-xs opacity-80">Please review the community rules — repeated issues can lead to a mute or suspension.</p>
      </div>
    </div>
  );
}

/** Community rules (admin-managed markdown) — collapsible in the sidebar, compact in the composer. */
export function CommunityRules({ variant = "sidebar" }: { variant?: "sidebar" | "composer" }) {
  const settings = useCommunitySettings();
  const [open, setOpen] = useState(variant === "sidebar");
  if (!settings?.rulesMarkdown?.trim()) return null;
  return (
    <div className={cn(variant === "sidebar" ? "border-t border-ink-100 pt-4" : "mt-3 rounded-lg border border-ink-100 bg-ink-50/60")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1.5 text-left font-semibold text-ink-500",
          variant === "sidebar" ? "px-3 text-xs uppercase tracking-wide text-ink-400" : "px-3 py-2 text-xs"
        )}
      >
        <BookOpen size={13} className="shrink-0" />
        <span className="flex-1">Community rules</span>
        <ChevronDown size={13} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <CommunityMarkdown className={cn("text-xs text-ink-600", variant === "sidebar" ? "mt-2 px-3" : "px-3 pb-3")}>
          {settings.rulesMarkdown}
        </CommunityMarkdown>
      )}
    </div>
  );
}

/** Pinned / Featured / official / waiting-for-review labels on a post. */
export function PostModerationLabels({ post }: { post: CommunityPostResponse }) {
  return (
    <>
      {post.official && (
        <Badge tone="brand" className="font-semibold">
          <BadgeCheck size={11} className="shrink-0" /> Official
        </Badge>
      )}
      {post.pinned && (
        <Badge tone="neutral">
          <Pin size={11} className="shrink-0" /> Pinned
        </Badge>
      )}
      {post.featured && (
        <Badge tone="gold">
          <Sparkles size={11} className="shrink-0" /> Featured
        </Badge>
      )}
      {(post.status === "PENDING" || post.status === "HIDDEN") && (
        <Badge tone="gold">
          <Clock size={11} className="shrink-0" /> Waiting for review
        </Badge>
      )}
      {post.locked && (
        <Badge tone="neutral">
          <Lock size={11} className="shrink-0" /> Locked
        </Badge>
      )}
    </>
  );
}

/** Body replacement for a post a moderator removed — the thread stays, only the author sees why. */
export function RemovedPostPlaceholder({ post }: { post: CommunityPostResponse }) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-sm italic text-ink-500">
      [Removed by moderators]
      {post.removedReason && <span className="mt-1 block not-italic text-xs text-ink-600">Reason: {post.removedReason}</span>}
    </div>
  );
}

/** Shown to the author only, on their own held post. */
export function PendingReviewNote() {
  return (
    <p className="mt-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800">
      Waiting for review — only you can see this post until a moderator approves it.
    </p>
  );
}
