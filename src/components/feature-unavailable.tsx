"use client";

import Link from "next/link";
import { CalendarOff, ShoppingBag } from "lucide-react";
import { useCommunitySettings, usePlatformFeatures } from "@/lib/community-settings";
import { PageSpinner } from "./ui/misc";

type GatedFeature = "ordering" | "bookings";

const COPY: Record<GatedFeature, { title: string; body: string }> = {
  ordering: {
    title: "Ordering is currently unavailable",
    body: "Online ordering is switched off for now. You can still browse the menu and contact the business directly.",
  },
  bookings: {
    title: "Bookings are currently unavailable",
    body: "Online booking is switched off for now. You can still contact the business directly.",
  },
};

/** One full-page "this feature is switched off" state (admin → System → Settings). */
export function FeatureUnavailable({
  feature,
  backHref = "/",
  backLabel = "Back to home",
}: {
  feature: GatedFeature;
  backHref?: string;
  backLabel?: string;
}) {
  const Icon = feature === "ordering" ? ShoppingBag : CalendarOff;
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-ink-500">
          <Icon size={26} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">{COPY[feature].title}</h1>
        <p className="mt-2 text-ink-500">{COPY[feature].body}</p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center rounded-lg bg-crimson-600 px-4 py-2 text-sm font-semibold text-white hover:bg-crimson-700"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Route-level gate for the order/booking pages: renders {@link FeatureUnavailable} instead of the
 * page while the feature is off, so the page never mounts and fires calls that would only 404.
 */
export function FeatureRouteGate({ feature, children }: { feature: GatedFeature; children: React.ReactNode }) {
  const settings = useCommunitySettings();
  const features = usePlatformFeatures();
  if (!settings) return <PageSpinner />;
  const on = feature === "ordering" ? features.orderingEnabled : features.bookingsEnabled;
  return on ? <>{children}</> : <FeatureUnavailable feature={feature} />;
}
