"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { modulesForKind } from "@/lib/category-modules";
import { canBook, canSellDirect } from "@/lib/commerce";
import { useNewOrderCount } from "@/lib/use-new-order-count";
import { useNewBookingCount } from "@/lib/use-new-booking-count";
import { cn } from "@/lib/utils";
import type { BusinessResponse, PlatformFeatures } from "@/lib/types";
import { usePlatformFeatures } from "@/lib/community-settings";

interface NavItem {
  label: string;
  href: string;
  /** exact-match route for active state; falls back to href */
  match?: string;
  external?: boolean;
  badge?: number;
}

function buildNavGroups(
  business: BusinessResponse,
  newOrderCount: number,
  newBookingCount: number,
  features: PlatformFeatures
): { title: string; items: NavItem[] }[] {
  const base = `/owner/${business.id}`;
  const moduleItems: NavItem[] = modulesForKind(business.categoryKind).map((m) => ({
    label: m.ownerLabel,
    href: `${base}/sections/${m.key}`,
  }));

  // Platform feature flags (admin → System → Settings) remove switched-off sections.
  const sells = features.orderingEnabled && canSellDirect(business.categoryKind);
  const books = features.bookingsEnabled && canBook(business.categoryKind);
  const commerceItems: NavItem[] = [
    ...(sells
      ? [
          { label: "Orders", href: `${base}/orders`, badge: newOrderCount },
          { label: "Order settings", href: `${base}/commerce` },
        ]
      : []),
    ...(books
      ? [
          { label: "Bookings", href: `${base}/bookings`, badge: newBookingCount },
          { label: "Staff schedules", href: `${base}/staff-schedule` },
          { label: "Booking settings", href: `${base}/commerce` },
        ]
      : []),
  ];

  const groups = [
    {
      title: "Manage",
      items: [
        { label: "Overview", href: base, match: base },
        { label: "Reviews", href: `${base}/reviews` },
        { label: "Rating trend", href: `${base}/insights` },
        ...(features.ownerChatEnabled
          ? [
              { label: "Messages", href: "/owner/inbox", external: true },
              { label: "Quick replies", href: `${base}/quick-replies` },
            ]
          : []),
      ],
    },
    {
      // V58 business promotion: Design Studio + results/boosts.
      title: "Promote",
      items: [
        { label: "Create promotion", href: `${base}/promote` },
        { label: "Promotions", href: `${base}/promotions` },
      ],
    },
    {
      title: "Content",
      items: [
        { label: "Business info", href: `${base}/edit` },
        { label: "Photos", href: `${base}/photos` },
        { label: "Business QR", href: `${base}/qr` },
        ...moduleItems,
        ...commerceItems,
        { label: "Offers", href: `${base}/offers` },
        { label: "Updates", href: `${base}/updates` },
      ],
    },
  ];
  return features.promotionsEnabled ? groups : groups.filter((g) => g.title !== "Promote");
}

/** Business switcher — current business + a dropdown of the rest, plus the "all
 *  businesses" / "add" escape hatches. */
function BusinessSwitcher({
  business,
  allBusinesses,
}: {
  business: BusinessResponse;
  allBusinesses: BusinessResponse[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const others = allBusinesses.filter((b) => b.id !== business.id);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-ink-200/70 bg-white px-3 py-2.5 text-left transition-colors hover:border-ink-300"
      >
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoUrl} alt="" className="h-8 w-8 flex-none rounded-lg border border-ink-200 object-cover" />
        ) : (
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-crimson-600 to-crimson-500 text-xs font-bold text-white">
            {business.name.charAt(0)}
          </div>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900">{business.name}</span>
          <span className="block truncate text-[11px] text-ink-400">{business.categoryName}</span>
        </span>
        <svg viewBox="0 0 20 20" className={cn("h-4 w-4 flex-none text-ink-400 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-ink-100 bg-surface shadow-pop">
          <div className="max-h-64 overflow-y-auto py-1">
            {others.map((b) => (
              <Link
                key={b.id}
                href={`/owner/${b.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
              >
                <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-ink-100 text-[10px] font-bold text-ink-500">
                  {b.name.charAt(0)}
                </div>
                <span className="truncate">{b.name}</span>
              </Link>
            ))}
            {others.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-400">This is your only listing.</p>
            )}
          </div>
          <div className="border-t border-ink-100 py-1">
            <Link href="/owner" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
              All my businesses
            </Link>
            <Link href="/owner/new" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium text-crimson-700 hover:bg-crimson-50">
              + Add a business
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function OwnerBusinessSidebar({
  business,
  allBusinesses,
}: {
  business: BusinessResponse;
  allBusinesses: BusinessResponse[];
}) {
  const pathname = usePathname();
  const newOrderCount = useNewOrderCount(canSellDirect(business.categoryKind) ? business.id : null);
  const newBookingCount = useNewBookingCount(canBook(business.categoryKind) ? business.id : null);
  const features = usePlatformFeatures();
  const groups = buildNavGroups(business, newOrderCount, newBookingCount, features);

  function isActive(item: NavItem) {
    if (item.external) return false;
    if (item.match) return pathname === item.match;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <aside className="shrink-0 lg:w-60">
      <BusinessSwitcher business={business} allBusinesses={allBusinesses} />

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => (
          <div key={group.title} className="flex gap-1 lg:mt-4 lg:block lg:gap-0 lg:first:mt-0">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 lg:block">
              {group.title}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors lg:block",
                  isActive(item)
                    ? "bg-crimson-50 font-medium text-crimson-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                )}
              >
                {item.label}
                {item.external && <span aria-hidden className="ml-1 text-ink-300">↗</span>}
                {!!item.badge && item.badge > 0 && (
                  <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-crimson-600 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}

        <div className="lg:mt-4 lg:border-t lg:border-ink-100 lg:pt-3">
          <Link
            href={`/business/${business.slug}`}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900 lg:block"
          >
            View public page
            <span aria-hidden className="text-ink-300">↗</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
