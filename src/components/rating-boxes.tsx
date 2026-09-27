import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "md" | "sm" | "xs";

/** Box side, and the white star inside it, per size — spec: md 24/16, sm 20/14, xs 16/11. */
const BOX_SIZE: Record<Size, string> = { md: "size-6", sm: "size-5", xs: "size-4" };
const ICON_SIZE: Record<Size, number> = { md: 16, sm: 14, xs: 11 };

function RatingBox({ fraction, boxClass, iconSize }: { fraction: number; boxClass: string; iconSize: number }) {
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-[4px]", boxClass)}>
      {fraction === 1 && <span className="absolute inset-0 bg-crimson-600 dark:bg-crimson-500" />}
      {fraction === 0 && <span className="absolute inset-0 bg-ink-200 dark:bg-ink-700" />}
      {fraction === 0.5 && (
        <>
          <span className="absolute inset-0 bg-ink-200 dark:bg-ink-700" />
          <span className="absolute inset-y-0 left-0 w-1/2 bg-crimson-600 dark:bg-crimson-500" />
        </>
      )}
      <Star size={iconSize} fill="currentColor" className="relative text-white" />
    </span>
  );
}

/**
 * The one rating display style across the whole site — five crimson/empty boxes, each
 * with a white star, replacing every old plain-text "★★★☆☆" row (business cards, the
 * business page header, review cards). Purely presentational: role="img" carries the
 * accessible name, the boxes themselves are aria-hidden. Not the review form's
 * interactive picker — see StarInput in star-rating.tsx for that, untouched by this.
 */
export function RatingBoxes({ rating, size = "sm" }: { rating: number; size?: Size }) {
  const rounded = Math.round(rating * 2) / 2;
  const boxClass = BOX_SIZE[size];
  const iconSize = ICON_SIZE[size];

  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fraction = Math.max(0, Math.min(1, rounded - i));
        return <RatingBox key={i} fraction={fraction} boxClass={boxClass} iconSize={iconSize} />;
      })}
    </div>
  );
}
