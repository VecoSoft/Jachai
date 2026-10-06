"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { catalogApi, commerceApi } from "@/lib/api";
import type { MenuItem, PublicCommerceView } from "@/lib/types";
import { addToCart, CartConflictError, setQuantity, startNewCart } from "@/lib/cart";
import { useCart } from "@/lib/use-cart";
import { formatTk } from "@/lib/commerce";
import { usePlatformFeatures } from "@/lib/community-settings";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { EmptyState, PageSpinner } from "./ui/misc";

/** True when this item can currently be ordered online — available + a positive numeric price. */
function isOrderable(item: MenuItem): boolean {
  return item.available && typeof item.price === "number" && item.price > 0;
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  );
}

/** Circular "+" overlapping the image's bottom-right corner — the compact add affordance. */
function AddCircle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add to cart"
      className="absolute -bottom-2 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-white bg-crimson-600 text-white shadow-lift transition-transform hover:scale-110 hover:bg-crimson-500 active:scale-95"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Same spot, but once the item is in the cart — a compact quantity pill instead of the "+". */
function QtyPill({ qty, onChange }: { qty: number; onChange: (next: number) => void }) {
  return (
    <div className="absolute -bottom-2 -right-1 flex h-8 items-stretch overflow-hidden rounded-full border-[2.5px] border-white bg-crimson-600 text-white shadow-lift">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(qty - 1)}
        className="flex w-7 items-center justify-center text-sm font-bold leading-none transition-colors hover:bg-crimson-500 active:scale-95"
      >
        −
      </button>
      <span className="flex w-4 items-center justify-center text-[11px] font-bold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= 50}
        className="flex w-7 items-center justify-center text-sm font-bold leading-none transition-colors hover:bg-crimson-500 active:scale-95 disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}

function MenuCard({
  item,
  orderingActive,
  cartQty,
  highlighted,
  onAdd,
  onSetQty,
}: {
  item: MenuItem;
  /** business is in DIRECT_ORDER, ordering on, not paused */
  orderingActive: boolean;
  cartQty: number;
  /** True when this is the card a deep link (e.g. an offer's "Order Now") pointed at. */
  highlighted?: boolean;
  onAdd: (item: MenuItem) => void;
  onSetQty: (item: MenuItem, qty: number) => void;
}) {
  const orderable = orderingActive && isOrderable(item);
  const hasOffer = item.activeOfferPrice != null;
  const isBogo = item.activeOfferType === "BUY_ONE_GET_ONE";
  const priceLabel = typeof item.price === "number" ? formatTk(item.price) : item.priceText;
  // A standalone discount (no linked Offer) — the Offer's own struck-through price wins when both are set.
  const hasDiscount = !hasOffer && typeof item.price === "number" && typeof item.compareAtPrice === "number" && item.compareAtPrice > item.price;

  return (
    <div
      id={`menu-item-${item.id}`}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-2xl border bg-white p-2.5 transition-all hover:border-ink-200 hover:shadow-card sm:p-3",
        highlighted ? "border-crimson-300 ring-2 ring-crimson-500/30" : "border-ink-100"
      )}
    >
      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-bold leading-tight text-ink-900">
          {item.name}
          {item.popular && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-amber-700">
              ★ Popular
            </span>
          )}
          {isBogo && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-crimson-50 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-crimson-700">
              Buy 1 Get 1
            </span>
          )}
          {hasOffer && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-crimson-50 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-crimson-700">
              Offer
            </span>
          )}
          {hasDiscount && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-crimson-50 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-crimson-700">
              Sale
            </span>
          )}
        </p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-500 sm:text-[13px]">{item.description}</p>
        )}
        {hasOffer ? (
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[15px] font-extrabold text-crimson-700">{formatTk(item.activeOfferPrice!)}</span>
            {priceLabel && <span className="text-xs text-ink-400 line-through">{priceLabel}</span>}
          </p>
        ) : hasDiscount ? (
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[15px] font-extrabold text-crimson-700">{formatTk(item.price!)}</span>
            <span className="text-xs text-ink-400 line-through">{formatTk(item.compareAtPrice!)}</span>
          </p>
        ) : (
          priceLabel && <p className="mt-1.5 text-[15px] font-extrabold text-ink-900">{priceLabel}</p>
        )}

        {/* Ordering state — only while the business is actively taking orders. */}
        {orderingActive && !orderable && (
          <p className="mt-1 text-[11px] font-semibold text-ink-400">
            {!item.available ? "Currently unavailable" : "Not available for online order"}
          </p>
        )}
      </div>

      <div className="relative flex-none">
        <div className="h-[100px] w-[100px] overflow-hidden rounded-xl border border-ink-100 bg-ink-50 transition-transform duration-300 group-hover:scale-[1.02] sm:h-[132px] sm:w-[132px]">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-200">
              <PlateIcon />
            </div>
          )}
        </div>

        {orderable &&
          (cartQty > 0 ? (
            <QtyPill qty={cartQty} onChange={(n) => onSetQty(item, n)} />
          ) : (
            <AddCircle onClick={() => onAdd(item)} />
          ))}
      </div>
    </div>
  );
}

/**
 * Public restaurant menu. Showcase-first: a "Popular items" strip, then the full
 * menu grouped by the free-text `menuSection` label. Cards mirror the familiar
 * food-delivery-app layout — a "+" circle overlapping the photo that turns into a
 * quantity pill once the item is in the (shared, one-business) cart. Non-orderable
 * cards stay visible with a short reason instead of any control.
 */
export function BusinessMenu({
  businessId,
  businessName,
  businessSlug,
  highlightItemId,
}: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  /** Deep-linked from e.g. an offer's "Order Now" — scrolls to and briefly highlights this card. */
  highlightItemId?: string | null;
}) {
  const { show } = useToast();
  const { cart } = useCart();
  // Hooks must run before the early returns below (admin "Ordering" feature flag).
  const orderingOn = usePlatformFeatures().orderingEnabled;
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [commerce, setCommerce] = useState<PublicCommerceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const scrolledToHighlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .menuItems(businessId)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    commerceApi
      .publicSettings(businessId)
      .then((c) => !cancelled && setCommerce(c))
      .catch(() => !cancelled && setCommerce(null));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  // A deep-linked item might only live in the collapsed-away full list (not
  // the Popular strip) — force it open so there's actually a card to scroll to.
  useEffect(() => {
    if (highlightItemId) setShowFull(true);
  }, [highlightItemId]);

  useEffect(() => {
    if (!highlightItemId || !items || scrolledToHighlight.current) return;
    if (!items.some((it) => it.id === highlightItemId)) return;
    scrolledToHighlight.current = true;
    const raf = requestAnimationFrame(() => {
      document.getElementById(`menu-item-${highlightItemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightItemId, items]);

  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items ?? []) {
      const key = it.menuSection?.trim() || "Menu";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!items) return <PageSpinner />;
  if (items.length === 0) return <EmptyState title="No menu items yet" />;

  const orderingLive = orderingOn && commerce?.mode === "DIRECT_ORDER" && commerce.orderingEnabled;
  const paused = !!orderingLive && commerce?.acceptingOrders === false;
  const orderingActive = !!orderingLive && !paused;
  const orderableCount = orderingActive ? items.filter(isOrderable).length : 0;

  function qtyInCart(itemId: string): number {
    if (!cart || cart.businessId !== businessId) return 0;
    return cart.lines.find((l) => l.menuItemId === itemId)?.quantity ?? 0;
  }

  function handleAdd(item: MenuItem) {
    if (typeof item.price !== "number") return;
    const businessRef = { id: businessId, name: businessName, slug: businessSlug };
    // "Was" price for the checkout "you save" line — the offer's own pre-discount list
    // price takes priority over compareAtPrice (an active offer is more precise/time-boxed);
    // BOGO has no numeric "was" price, it's shown as its own separate line instead.
    const compareAtPrice =
      item.activeOfferPrice != null
        ? item.price
        : item.compareAtPrice != null && item.compareAtPrice > item.price
          ? item.compareAtPrice
          : null;
    // Mirrors OrderService#placeOrder's server-authoritative pricing — the cart
    // should never show a different number than what checkout actually charges.
    const itemRef = {
      id: item.id,
      name: item.name,
      price: item.activeOfferPrice ?? item.price,
      isBogo: item.activeOfferType === "BUY_ONE_GET_ONE",
      compareAtPrice,
    };
    try {
      addToCart(businessRef, itemRef, 1);
      show(`${item.name} added to cart`, "success");
    } catch (e) {
      if (e instanceof CartConflictError) {
        const ok = window.confirm(
          `Your cart has items from ${e.existingBusinessName}. Starting a new order will clear it. Continue?`
        );
        if (ok) {
          startNewCart(businessRef, itemRef, 1);
          show(`Started a new cart · ${item.name} added`, "success");
        }
      } else {
        show(errorMessage(e), "error");
      }
    }
  }

  function handleSetQty(item: MenuItem, qty: number) {
    // The item is already in this business's cart, so no cross-business
    // conflict is possible — mutate the shared cart directly.
    setQuantity(item.id, qty);
  }

  const popular = items.filter((i) => i.popular);
  const collapsed = popular.length > 0 && !showFull;

  const renderCard = (it: MenuItem) => (
    <MenuCard
      key={it.id}
      item={it}
      orderingActive={orderingActive}
      cartQty={qtyInCart(it.id)}
      highlighted={it.id === highlightItemId}
      onAdd={handleAdd}
      onSetQty={handleSetQty}
    />
  );

  return (
    <div className="space-y-5">
      {/* Ordering status banner — accurate about whether anything can be ordered. */}
      {orderingActive && orderableCount > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <span className="text-sm leading-none">🛍️</span>
          This restaurant takes direct orders — add items to your cart to check out.
        </p>
      )}
      {orderingActive && orderableCount === 0 && (
        <p className="rounded-xl bg-sand-100 px-3 py-2 text-xs font-medium text-ink-600">
          Online ordering is currently unavailable for these menu items.
        </p>
      )}
      {paused && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          This restaurant is not accepting new orders right now
          {commerce?.pauseReason ? ` — ${commerce.pauseReason}` : ""}. You can still browse the menu.
        </p>
      )}

      {popular.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-base font-bold text-ink-900">Popular items</h2>
          <div className="space-y-2">{popular.map(renderCard)}</div>
        </section>
      )}

      {collapsed ? (
        <button
          type="button"
          onClick={() => setShowFull(true)}
          className="text-sm font-semibold text-crimson-700 hover:underline"
        >
          View full menu ({items.length} items)
        </button>
      ) : (
        groups.map(([section, rows]) => {
          // Items already shown in the Popular strip above don't repeat down here.
          const sectionRows = popular.length > 0 ? rows.filter((r) => !r.popular) : rows;
          if (sectionRows.length === 0) return null;
          return (
            <section key={section}>
              <h2 className="mb-2 font-display text-base font-bold text-ink-900">{section}</h2>
              <div className="space-y-2">{sectionRows.map(renderCard)}</div>
            </section>
          );
        })
      )}
    </div>
  );
}
