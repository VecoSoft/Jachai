"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, LifeBuoy, LogOut, Receipt, SlidersHorizontal, Smile, Star, Store, Tag, User, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/account/profile", label: "Edit profile", icon: User },
  { href: "/account/community", label: "Community profile", icon: Smile },
];

const PREFERENCE_ITEMS: NavItem[] = [{ href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal }];

const ACTIVITY_ITEMS: NavItem[] = [
  { href: "/me/reviews", label: "My reviews", icon: Star },
  { href: "/me/bookmarks", label: "Saved", icon: Bookmark },
  { href: "/orders", label: "Orders & bookings", icon: Receipt },
  { href: "/me/offers", label: "My offers", icon: Tag },
];

const HELP_ITEMS: NavItem[] = [{ href: "/help", label: "Help & support", icon: LifeBuoy }];

const itemClass = (active: boolean) =>
  cn(
    "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium",
    interactiveTransition,
    focusRing,
    active
      ? "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-400"
      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
  );

/**
 * Persistent left nav for the whole /account section at md+ (see app/(site)/account/layout.tsx) —
 * replaces the mobile grouped list's drill-down navigation with an always-visible pane switcher.
 * "Edit profile" also highlights for the bare /account URL, since that's where its content renders
 * by default (see account/page.tsx).
 */
export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout, switchAccount } = useAuth();
  const { show } = useToast();

  const isBusinessAccount = user?.role === "BUSINESS_OWNER";
  const canSwitchAccount = Boolean(profile?.hasLinkedAccount);

  async function handleSwitchAccount() {
    try {
      await switchAccount();
      router.push(isBusinessAccount ? "/" : "/owner");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  function isActive(href: string) {
    if (href === "/account/profile") return pathname === "/account" || pathname === "/account/profile";
    return pathname === href;
  }

  function renderGroup(items: NavItem[]) {
    return (
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={itemClass(isActive(item.href))}>
              <item.icon size={17} strokeWidth={1.75} className="shrink-0" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <nav className="flex flex-col gap-4">
      <h1 className="px-3 font-display text-xl font-bold text-ink-900 dark:text-ink-100">Settings</h1>

      <div>{renderGroup(ACCOUNT_ITEMS)}</div>

      {canSwitchAccount && (
        <button type="button" onClick={handleSwitchAccount} className={cn(itemClass(false), "w-full text-left")}>
          <Store size={17} strokeWidth={1.75} className="shrink-0" />
          {isBusinessAccount ? "Switch to personal account" : "Switch to business account"}
        </button>
      )}

      <div className="border-t border-ink-100 pt-4 dark:border-ink-800">{renderGroup(PREFERENCE_ITEMS)}</div>

      <div className="border-t border-ink-100 pt-4 dark:border-ink-800">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Activity</p>
        {renderGroup(ACTIVITY_ITEMS)}
      </div>

      <div className="border-t border-ink-100 pt-4 dark:border-ink-800">{renderGroup(HELP_ITEMS)}</div>

      <div className="border-t border-ink-100 pt-4 dark:border-ink-800">
        <button
          type="button"
          onClick={() => logout()}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-500/10",
            interactiveTransition,
            focusRing
          )}
        >
          <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
          Log out
        </button>
      </div>
    </nav>
  );
}
