"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { usePlatformFeatures } from "@/lib/community-settings";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { useHomeSearch } from "@/lib/home-search-context";
import { useLanguage } from "@/lib/language-context";
import { useBusinessInboxUnreadCount } from "@/lib/use-business-inbox-unread";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import { PrimarySearchBar } from "./business-filters";
import { ThemeToggle } from "./theme-toggle";

function Logo({ light }: { light: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex shrink-0 items-center gap-2 font-display font-extrabold text-xl sm:text-2xl transition-colors",
        light ? "text-white" : "text-ink-900"
      )}
    >
      <svg viewBox="0 0 24 24" className={cn("h-7 w-7 transition-colors", light ? "text-white" : "text-crimson-600")} fill="none">
        <path
          d="M12 2 L20 5 V11.5 C20 16.2 16.6 20.4 12 22 C7.4 20.4 4 16.2 4 11.5 V5 Z"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M12 2 L20 5 V11.5 C20 16.2 16.6 20.4 12 22 C7.4 20.4 4 16.2 4 11.5 V5 Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M8.3 11.7 L10.8 14.3 L15.7 8.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Jachai
    </Link>
  );
}

function AccountMenuLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "block rounded-lg px-3 py-2.5 text-base transition-colors duration-150",
        active ? "bg-crimson-50 text-crimson-700 font-medium" : "text-ink-700 hover:bg-ink-50 hover:text-crimson-700"
      )}
    >
      {children}
    </Link>
  );
}

function Avatar({ photoUrl, size = 28 }: { photoUrl: string | null | undefined; size?: number }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-black/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="rounded-full bg-ink-200 text-ink-500 p-1" fill="currentColor">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.14 0-7.5 2.46-7.5 5.5v.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-.5c0-3.04-3.36-5.5-7.5-5.5Z" />
    </svg>
  );
}

export function Navbar() {
  const { user, profile, logout, switchAccount } = useAuth();
  const { openLogin, openSignup } = useAuthModal();
  const { openModal: openUsernameModal } = useCommunityUsernameModal();
  const { t } = useLanguage();
  const { show } = useToast();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const pathname = usePathname();
  const isHero = pathname === "/";
  const { params, setParams, locationStatus, useMyLocation } = useHomeSearch();
  const [scrolled, setScrolled] = useState(!isHero);
  // Admin feature flags — switched-off features drop out of the navigation.
  const features = usePlatformFeatures();
  // Maintenance mode: visitors get a bare header (logo + theme toggle) that makes no API calls.
  const maintenanceLocked = features.maintenanceMode && user?.role !== "ADMIN";
  const inboxUnreadCount = useBusinessInboxUnreadCount(features.ownerChatEnabled && !maintenanceLocked);

  // Consumer and Business are two separate accounts (see lib/auth-context.tsx's
  // switchAccount) — isBusinessAccount reads straight off the JWT-decoded role,
  // canSwitchAccount off whether this account is paired with the other one.
  const isBusinessAccount = user?.role === "BUSINESS_OWNER";
  const canSwitchAccount = Boolean(profile?.hasLinkedAccount);

  async function handleSwitchAccount() {
    setSwitching(true);
    try {
      await switchAccount();
      router.push(isBusinessAccount ? "/" : "/owner");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSwitching(false);
    }
  }

  // On the home page the navbar starts transparent, floating over the hero
  // photo; everywhere else (no hero behind it) it's solid from the first paint.
  useEffect(() => {
    if (!isHero) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHero]);

  const transparent = isHero && !scrolled;
  const linkClass = cn(
    "inline-flex min-h-11 items-center whitespace-nowrap px-2.5 lg:px-3 rounded-full",
    interactiveTransition,
    focusRing,
    transparent ? "hover:bg-white/15 text-white" : "hover:bg-crimson-50 hover:text-crimson-700 text-ink-700"
  );
  const accountLinkClass = cn(
    "inline-flex min-h-11 items-center whitespace-nowrap px-2.5 lg:px-3 rounded-full text-sm lg:text-base font-medium",
    interactiveTransition,
    focusRing,
    transparent ? "text-white hover:bg-white/15" : "text-ink-600 hover:bg-ink-100"
  );

  // Close the mobile menu whenever the route changes (e.g. browser back).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (maintenanceLocked) {
    return (
      <header className="fixed top-0 left-0 w-full z-50 border-b border-ink-100 bg-surface/90 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Logo light={false} />
          <ThemeToggle className="text-ink-600 hover:bg-ink-100" />
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-colors duration-300",
        transparent ? "bg-transparent border-b border-transparent" : "border-b border-ink-100 bg-surface/90 backdrop-blur shadow-sm"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-3">
        <Logo light={transparent} />

        {/* Primary search (free-text query + Near me) lives right here on the
            home page — see lib/home-search-context.tsx for the shared state
            this and page.tsx's results grid both read/write. Category
            selection moved to the hero's CategoryQuickNav tab row; Price/
            Rating moved to a refine row by the results grid. */}
        {isHero && (
          <div className="hidden lg:flex items-center min-w-0 mx-2 flex-1">
            {/* The box keeps its own draft text and only commits on submit — typing
                fetches debounced suggestions, never a full search per keystroke. */}
            <PrimarySearchBar
              query={params.q ?? ""}
              onSearch={(q) => setParams({ ...params, q, page: 0 })}
              onUseMyLocation={useMyLocation}
              locationStatus={locationStatus}
              light={transparent}
            />
          </div>
        )}

        <nav className="hidden md:flex shrink-0 items-center gap-0.5 lg:gap-1 text-sm lg:text-base font-medium ml-auto">
          {features.communityEnabled && (
            <Link href="/community" className={linkClass}>
              Community
            </Link>
          )}
          {/* Once this account is linked, "Switch to X" replaces "For Business" —
              same plain nav-link treatment, no separate bordered button, so the
              nav reads exactly the same whether or not an account is linked. */}
          {user && canSwitchAccount && (
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={switching}
              className={cn(linkClass, "relative disabled:opacity-50")}
            >
              {isBusinessAccount ? "Switch to Personal" : "Switch to Business"}
              {!isBusinessAccount && inboxUnreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-crimson-600" aria-hidden />
              )}
            </button>
          )}
          {user && !isBusinessAccount && !canSwitchAccount && (
            <Link href="/owner" className={cn(linkClass, "relative")}>
              {t("nav.for_business")}
              {inboxUnreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-crimson-600" aria-hidden />
              )}
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className={linkClass}>
              {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="hidden md:flex shrink-0 items-center gap-1 lg:gap-2">
          <ThemeToggle
            className={
              transparent ? "text-white hover:bg-white/15" : "text-ink-600 hover:bg-ink-100"
            }
          />
          {user ? (
            <>
              <div
                className="relative"
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
              >
                <Link href="/account" className={cn(accountLinkClass, "flex items-center gap-2")}>
                  <Avatar photoUrl={profile?.profilePhotoUrl} />
                  {/* Name only where there's room — the avatar alone identifies the menu on tablets/small laptops. */}
                  <span className={cn("max-w-[9rem] truncate", isHero ? "hidden xl:inline" : "hidden lg:inline")}>
                    {profile?.name || t("nav.account")}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    className={cn("h-3.5 w-3.5 transition-transform duration-150", accountMenuOpen && "rotate-180")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                {/* pt-2 keeps this touching the trigger above (no dead zone) while still
                    giving the visible panel some breathing room below it. */}
                {accountMenuOpen && (
                  <div className="absolute right-0 top-full w-56 pt-2 z-50">
                    <div className="rounded-xl border border-ink-100 bg-surface shadow-pop p-1.5">
                      {isBusinessAccount ? (
                        <>
                          <AccountMenuLink
                            href="/owner"
                            active={pathname === "/owner"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            My Businesses
                          </AccountMenuLink>
                          {features.ownerChatEnabled && (
                            <AccountMenuLink
                              href="/owner/inbox"
                              active={pathname.startsWith("/owner/inbox")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              Inbox
                              {inboxUnreadCount > 0 && (
                                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-crimson-600" aria-hidden />
                              )}
                            </AccountMenuLink>
                          )}
                          {profile?.communityUsername ? (
                            <AccountMenuLink
                              href={`/community/u/${profile.communityUsername}`}
                              active={pathname.startsWith("/community/u/")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              Community profile
                            </AccountMenuLink>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMenuOpen(false);
                                openUsernameModal();
                              }}
                              className="block w-full rounded-lg px-3 py-2.5 text-left text-base text-ink-700 transition-colors duration-150 hover:bg-ink-50 hover:text-crimson-700"
                            >
                              Set up Community username
                            </button>
                          )}
                          <div className="my-1 h-px bg-ink-100" />
                          <AccountMenuLink
                            href="/account"
                            active={pathname === "/account"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            {t("nav.account_settings")}
                          </AccountMenuLink>
                        </>
                      ) : (
                        <>
                          <AccountMenuLink
                            href="/me/reviews"
                            active={pathname === "/me/reviews"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            {t("nav.my_reviews")}
                          </AccountMenuLink>
                          <AccountMenuLink
                            href="/me/bookmarks"
                            active={pathname === "/me/bookmarks"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            {t("nav.bookmarks")}
                          </AccountMenuLink>
                          <AccountMenuLink
                            href="/me/offers"
                            active={pathname === "/me/offers"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            My offers
                          </AccountMenuLink>
                          {features.orderingEnabled && (
                            <AccountMenuLink
                              href="/orders"
                              active={pathname.startsWith("/orders")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              My orders
                            </AccountMenuLink>
                          )}
                          {features.bookingsEnabled && (
                            <AccountMenuLink
                              href="/bookings"
                              active={pathname.startsWith("/bookings")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              My bookings
                            </AccountMenuLink>
                          )}
                          {features.ownerChatEnabled && (
                            <AccountMenuLink
                              href="/me/messages"
                              active={pathname.startsWith("/me/messages")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              {t("nav.messages")}
                            </AccountMenuLink>
                          )}
                          {profile?.communityUsername ? (
                            <AccountMenuLink
                              href={`/community/u/${profile.communityUsername}`}
                              active={pathname.startsWith("/community/u/")}
                              onClick={() => setAccountMenuOpen(false)}
                            >
                              Community profile
                            </AccountMenuLink>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAccountMenuOpen(false);
                                openUsernameModal();
                              }}
                              className="block w-full rounded-lg px-3 py-2.5 text-left text-base text-ink-700 transition-colors duration-150 hover:bg-ink-50 hover:text-crimson-700"
                            >
                              Set up Community username
                            </button>
                          )}
                          <div className="my-1 h-px bg-ink-100" />
                          <AccountMenuLink
                            href="/account"
                            active={pathname === "/account"}
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            {t("nav.account_settings")}
                          </AccountMenuLink>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => logout()} className={accountLinkClass}>
                {t("nav.log_out")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={openLogin} className={accountLinkClass}>
                {t("nav.log_in")}
              </button>
              <button
                type="button"
                onClick={openSignup}
                className="whitespace-nowrap px-4 lg:px-5 py-2 rounded-full bg-crimson-600 text-white text-sm lg:text-base font-semibold shadow-sm hover:bg-crimson-700"
              >
                {t("nav.sign_up")}
              </button>
            </>
          )}
        </div>

        {features.communityEnabled && (
          <Link href="/community" className={cn(linkClass, "md:hidden ml-auto text-sm font-medium")}>
            Community
          </Link>
        )}

        <button
          type="button"
          className={cn(
            "md:hidden shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-full",
            interactiveTransition,
            focusRing,
            transparent ? "text-white hover:bg-white/15" : "hover:bg-ink-100"
          )}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-ink-100 bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-1 text-base shadow-pop">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-ink-500">{t("nav.theme")}</span>
            <ThemeToggle className="text-ink-600 hover:bg-ink-100" />
          </div>
          {user && (
            <>
              {isBusinessAccount ? (
                <>
                  <Link href="/owner" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                    My Businesses
                  </Link>
                  {features.ownerChatEnabled && (
                    <Link
                      href="/owner/inbox"
                      className="px-3 py-2 rounded hover:bg-ink-100 flex items-center gap-2"
                      onClick={() => setMenuOpen(false)}
                    >
                      Inbox
                      {inboxUnreadCount > 0 && <span className="h-2 w-2 rounded-full bg-crimson-600" aria-hidden />}
                    </Link>
                  )}
                  {profile?.communityUsername ? (
                    <Link
                      href={`/community/u/${profile.communityUsername}`}
                      className="px-3 py-2 rounded hover:bg-ink-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      Community profile
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="px-3 py-2 rounded hover:bg-ink-100 text-left"
                      onClick={() => {
                        setMenuOpen(false);
                        openUsernameModal();
                      }}
                    >
                      Set up Community username
                    </button>
                  )}
                  {canSwitchAccount && (
                    <button
                      type="button"
                      disabled={switching}
                      className="px-3 py-2 rounded hover:bg-ink-100 text-left disabled:opacity-50"
                      onClick={() => {
                        setMenuOpen(false);
                        handleSwitchAccount();
                      }}
                    >
                      Switch to Personal
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Link href="/me/reviews" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                    {t("nav.my_reviews")}
                  </Link>
                  <Link href="/me/bookmarks" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                    {t("nav.bookmarks")}
                  </Link>
                  <Link href="/me/offers" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                    My offers
                  </Link>
                  {features.orderingEnabled && (
                    <Link href="/orders" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                      My orders
                    </Link>
                  )}
                  {features.bookingsEnabled && (
                    <Link href="/bookings" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                      My bookings
                    </Link>
                  )}
                  {features.ownerChatEnabled && (
                    <Link href="/me/messages" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
                      {t("nav.messages")}
                    </Link>
                  )}
                  {profile?.communityUsername ? (
                    <Link
                      href={`/community/u/${profile.communityUsername}`}
                      className="px-3 py-2 rounded hover:bg-ink-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      Community profile
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="px-3 py-2 rounded hover:bg-ink-100 text-left"
                      onClick={() => {
                        setMenuOpen(false);
                        openUsernameModal();
                      }}
                    >
                      Set up Community username
                    </button>
                  )}
                  <div className="my-1 h-px bg-ink-100" />
                  {canSwitchAccount ? (
                    <button
                      type="button"
                      disabled={switching}
                      className="px-3 py-2 rounded hover:bg-ink-100 flex items-center gap-2 text-left disabled:opacity-50"
                      onClick={() => {
                        setMenuOpen(false);
                        handleSwitchAccount();
                      }}
                    >
                      Switch to Business
                      {inboxUnreadCount > 0 && <span className="h-2 w-2 rounded-full bg-crimson-600" aria-hidden />}
                    </button>
                  ) : (
                    <Link
                      href="/owner"
                      className="px-3 py-2 rounded hover:bg-ink-100 flex items-center gap-2"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t("nav.for_business")}
                      {inboxUnreadCount > 0 && <span className="h-2 w-2 rounded-full bg-crimson-600" aria-hidden />}
                    </Link>
                  )}
                </>
              )}
            </>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="px-3 py-2 rounded hover:bg-ink-100" onClick={() => setMenuOpen(false)}>
              {t("nav.admin")}
            </Link>
          )}
          {user ? (
            <>
              <Link
                href="/account"
                className="px-3 py-2 rounded hover:bg-ink-100 flex items-center gap-2"
                onClick={() => setMenuOpen(false)}
              >
                <Avatar photoUrl={profile?.profilePhotoUrl} size={24} />
                <span className="min-w-0 truncate">{profile?.name || t("nav.account")}</span>
              </Link>
              <button onClick={() => logout()} className="text-left px-3 py-2 rounded hover:bg-ink-100 text-rose-600">
                {t("nav.log_out")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="px-3 py-2 rounded hover:bg-ink-100 text-center"
                onClick={() => {
                  setMenuOpen(false);
                  openLogin();
                }}
              >
                {t("nav.log_in")}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-full bg-crimson-600 text-white font-semibold text-center"
                onClick={() => {
                  setMenuOpen(false);
                  openSignup();
                }}
              >
                {t("nav.sign_up")}
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}