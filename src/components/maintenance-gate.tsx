"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePlatformFeatures } from "@/lib/community-settings";

/**
 * Site-wide maintenance mode (admin → System → Settings). While it's on every API call except
 * login answers 503, so instead of a page full of errors the site shows the admin's message.
 * Admins still see the site (the server lets their requests through too), and the login page
 * stays reachable so they can sign in.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const features = usePlatformFeatures();
  const { user } = useAuth();
  const pathname = usePathname();

  if (!features.maintenanceMode || pathname === "/login") {
    return <>{children}</>;
  }

  if (user?.role === "ADMIN") {
    return (
      <>
        {children}
        <div className="fixed inset-x-0 bottom-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-white dark:bg-amber-400 dark:text-ink-900">
          Maintenance mode is on — visitors only see the maintenance message.
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-24 pb-8">
      <div className="max-w-md text-center">
        <p className="font-display text-2xl font-bold text-ink-900">We&apos;ll be right back</p>
        <p className="mt-3 text-ink-500">
          {features.maintenanceMessage ?? "Jachai is down for scheduled maintenance. Please check back soon."}
        </p>
      </div>
    </div>
  );
}
