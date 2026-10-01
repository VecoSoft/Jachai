"use client";

import { useLanguage } from "@/lib/language-context";
import type { CommunityGender } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * V59: the small M/F badge shown right after u/username. Renders nothing when the member hid it
 * or hasn't chosen yet (the API sends null in both cases).
 */
export function CommunityGenderBadge({ gender, className }: { gender?: CommunityGender | null; className?: string }) {
  const { t } = useLanguage();
  if (gender !== "M" && gender !== "F") return null;
  const label = gender === "M" ? t("community.gender.male") : t("community.gender.female");
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none",
        gender === "M"
          ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
          : "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
        className
      )}
    >
      {gender}
    </span>
  );
}
