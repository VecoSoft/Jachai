"use client";

import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { useCommunitySettings } from "@/lib/community-settings";
import { PageSpinner } from "./ui/misc";

/**
 * Wraps the whole /community/* shell. While the community is switched off (admin maintenance
 * switch or the platform-wide Community flag) every community route renders this one full-page
 * state instead of the feed, sidebars and per-widget error boxes. Waits for the settings on the
 * first visit so the feed never flashes "disabled" errors before the state is known.
 */
export function CommunityGate({ children }: { children: React.ReactNode }) {
  const settings = useCommunitySettings();

  if (!settings) return <PageSpinner />;
  if (settings.communityEnabled) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-ink-500">
          <MessageSquareOff size={26} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">Community is unavailable right now</h1>
        {settings.maintenanceMessage && <p className="mt-2 text-ink-500">{settings.maintenanceMessage}</p>}
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-lg bg-crimson-600 px-4 py-2 text-sm font-semibold text-white hover:bg-crimson-700"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
