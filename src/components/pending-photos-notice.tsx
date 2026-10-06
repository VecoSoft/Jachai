"use client";

import { useEffect, useState } from "react";
import { photosApi } from "@/lib/api";
import type { MyModeratedPhoto } from "@/lib/types";
import { PrivateImage } from "./private-image";

const SOURCE_LABELS: Record<MyModeratedPhoto["source"], string> = {
  BUSINESS_PHOTO: "Gallery photo",
  COVER: "Cover photo",
  LOGO: "Logo",
  MENU_ITEM: "Menu photo",
  POST: "Community post photo",
  REVIEW: "Review photo",
};

/**
 * The signed-in user's photos that are still "Waiting for review" (or were not approved).
 * New photos only go public after a moderator approves them; until then they're visible here
 * and nowhere else. Renders nothing when there are none. `businessId` narrows it to one listing.
 */
export function PendingPhotosNotice({ businessId }: { businessId?: string }) {
  const [photos, setPhotos] = useState<MyModeratedPhoto[] | null>(null);

  useEffect(() => {
    let alive = true;
    photosApi
      .mine()
      .then((all) => alive && setPhotos(businessId ? all.filter((p) => p.businessId === businessId) : all))
      .catch(() => alive && setPhotos([]));
    return () => {
      alive = false;
    };
  }, [businessId]);

  if (!photos || photos.length === 0) return null;
  const pending = photos.filter((p) => p.status === "PENDING");
  const rejected = photos.filter((p) => p.status === "REJECTED");

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 dark:border-amber-400/30">
      <p className="text-sm font-semibold text-ink-900">
        {pending.length > 0
          ? `${pending.length} photo${pending.length > 1 ? "s" : ""} waiting for review`
          : "Some photos were not approved"}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">
        New photos appear on your page once our team approves them — usually within a day.
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[...pending, ...rejected].map((p) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink-100">
            {p.status === "PENDING" ? (
              <PrivateImage src={p.url} className="h-full w-full object-cover opacity-80" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-ink-400">
                Removed
              </div>
            )}
            <span
              className={
                p.status === "PENDING"
                  ? "absolute inset-x-0 bottom-0 bg-amber-500/90 px-1 py-0.5 text-center text-[10px] font-semibold text-white dark:bg-amber-400/90 dark:text-ink-900"
                  : "absolute inset-x-0 bottom-0 bg-rose-600/90 px-1 py-0.5 text-center text-[10px] font-semibold text-white dark:bg-rose-500/90"
              }
              title={p.reason ?? undefined}
            >
              {p.label}
            </span>
            <span className="sr-only">{SOURCE_LABELS[p.source]}</span>
          </li>
        ))}
      </ul>
      {rejected.some((p) => p.reason) && (
        <ul className="mt-2 space-y-0.5 text-xs text-ink-500">
          {rejected
            .filter((p) => p.reason)
            .map((p) => (
              <li key={p.id}>
                {SOURCE_LABELS[p.source]} not approved: {p.reason}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
