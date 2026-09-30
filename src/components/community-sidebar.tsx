"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Compass, HelpCircle, Home, MapPin, MessageSquare, Settings, Star, Tag, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CommunityRules } from "./community-moderation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Custom active-match — most items just compare pathname, Questions/Reviews compare a query param too. */
  isActive?: (pathname: string, params: URLSearchParams) => boolean;
  /** Gated items (Following/Followers) need a logged-in Community username — resolved at click time, not render time. */
  requiresCommunityProfile?: boolean;
}

const COMMUNITY_ITEMS: NavItem[] = [
  { href: "/community", label: "Home", icon: Home, isActive: (p, params) => p === "/community" && !params.get("postType") },
  { href: "/community/explore", label: "Explore", icon: Compass },
  {
    href: "/community?postType=QUESTION",
    label: "Questions",
    icon: HelpCircle,
    isActive: (p, params) => p === "/community" && params.get("postType") === "QUESTION",
  },
  {
    href: "/community?postType=RECOMMENDATION",
    label: "Reviews",
    icon: Star,
    isActive: (p, params) => p === "/community" && params.get("postType") === "RECOMMENDATION",
  },
  {
    href: "/community?postType=DISCUSSION",
    label: "Discussions",
    icon: MessageSquare,
    isActive: (p, params) => p === "/community" && params.get("postType") === "DISCUSSION",
  },
  { href: "/community/offers", label: "Offers", icon: Tag },
  { href: "/me/bookmarks", label: "Saved", icon: Bookmark },
];

const SOCIAL_ITEMS: NavItem[] = [
  { href: "/community/following", label: "Following", icon: UserCheck, requiresCommunityProfile: true },
  { href: "/community/followers", label: "Followers", icon: Users, requiresCommunityProfile: true },
  { href: "/community/explore#nearby", label: "Nearby", icon: MapPin },
  { href: "/account", label: "Settings", icon: Settings },
];

/**
 * Left-nav for the whole /community section (see app/(site)/community/layout.tsx).
 * Also doubles as the data source for the mobile pill row (community-mobile-nav.tsx)
 * so the two never drift out of sync.
 */
export function CommunitySidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();
  const { openModal: openUsernameModal } = useCommunityUsernameModal();

  function isActive(item: NavItem) {
    if (item.isActive) return item.isActive(pathname, searchParams);
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function resolvedHref(item: NavItem) {
    if (!item.requiresCommunityProfile) return item.href;
    // Following/Followers are per-username routes — point at the logged-in user's own list.
    return profile?.communityUsername ? `/community/u/${profile.communityUsername}${item.href.replace("/community", "")}` : item.href;
  }

  function handleGatedClick(e: React.MouseEvent, item: NavItem) {
    if (!item.requiresCommunityProfile) return;
    if (!user) {
      e.preventDefault();
      openLogin();
      return;
    }
    if (!profile?.communityUsername) {
      e.preventDefault();
      openUsernameModal();
    }
  }

  function renderGroup(items: NavItem[]) {
    return (
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.label}>
              <Link
                href={resolvedHref(item)}
                onClick={(e) => handleGatedClick(e, item)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium",
                  interactiveTransition,
                  focusRing,
                  active
                    ? "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-400"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                )}
              >
                <item.icon size={15} className="shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-4", className)}>
      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Community</p>
        <div className="mt-1.5">{renderGroup(COMMUNITY_ITEMS)}</div>
      </div>
      <div className="border-t border-ink-100 pt-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Social</p>
        <div className="mt-1.5">{renderGroup(SOCIAL_ITEMS)}</div>
      </div>
      <CommunityRules variant="sidebar" />
    </nav>
  );
}

export { COMMUNITY_ITEMS, SOCIAL_ITEMS };
export type { NavItem };
