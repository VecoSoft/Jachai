"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** The read-only rating display used to live here as StarDisplay — replaced everywhere
 *  by <RatingBoxes /> (components/rating-boxes.tsx), the one rating style across the site.
 *  This file now holds only the interactive 1-5 picker below, untouched by that change. */
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;
  return (
    <div className="flex gap-1 text-3xl" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(n)}
          className={cn(
            "transition-transform hover:scale-110",
            n <= active ? "text-crimson-600" : "text-ink-200"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
