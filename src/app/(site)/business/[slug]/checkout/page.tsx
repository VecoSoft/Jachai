"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { businessApi, commerceApi, orderApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useCart } from "@/lib/use-cart";
import { billedQty, clearCart, removeLine, setQuantity } from "@/lib/cart";
import { formatTk, paymentMethodLabel } from "@/lib/commerce";
import { errorMessage } from "@/lib/toast-context";
import type {
  BusinessResponse,
  DeliveryQuote,
  FulfillmentType,
  PaymentMethod,
  PublicCommerceView,
} from "@/lib/types";
import { LeafletLocationPicker } from "@/components/leaflet-location-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { ErrorBanner, PageSpinner } from "@/components/ui/misc";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { useCommunitySettings, usePlatformFeatures } from "@/lib/community-settings";

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();
  const { cart, count, subtotal } = useCart();
  // Admin "Ordering" switch (System → Settings). Null settings = not loaded yet.
  const settingsLoaded = useCommunitySettings() !== null;
  const orderingOn = usePlatformFeatures().orderingEnabled;

  const [business, setBusiness] = useState<BusinessResponse | null>(null);
  const [commerce, setCommerce] = useState<PublicCommerceView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  // Ordering switched off: drop this business's cart — it can no longer be checked out.
  useEffect(() => {
    if (settingsLoaded && !orderingOn && cart && cart.businessSlug === slug) clearCart();
  }, [settingsLoaded, orderingOn, cart, slug]);

  // ---- load business + commerce -------------------------------------------
  useEffect(() => {
    if (!slug || !orderingOn) return;
    let cancelled = false;
    businessApi
      .getBySlug(slug)
      .then((b) => {
        if (cancelled) return;
        setBusiness(b);
        setPin({ lat: b.latitude, lng: b.longitude });
        return commerceApi.publicSettings(b.id);
      })
      .then((c) => !cancelled && c && setCommerce(c))
      .catch((e) => !cancelled && setLoadError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [slug, orderingOn]);

  // Prefill contact from the profile once.
  useEffect(() => {
    if (profile) {
      setName((n) => n || profile.name || "");
      setPhone((p) => p || profile.phoneNumber || "");
    }
  }, [profile]);

  // Delivery is only a real option once the business has at least one configured
  // zone — otherwise every quote would come back non-deliverable and the customer
  // would hit a dead end after already picking it.
  const deliveryAvailable = commerce ? commerce.ownDeliveryEnabled && commerce.hasDeliveryZones : false;

  // Default the fulfillment choice to the first enabled option.
  useEffect(() => {
    if (!commerce || fulfillment) return;
    if (commerce.pickupEnabled) setFulfillment("PICKUP");
    else if (deliveryAvailable) setFulfillment("OWN_DELIVERY");
  }, [commerce, fulfillment, deliveryAvailable]);

  // Default payment to the first enabled option.
  useEffect(() => {
    if (!commerce || payment) return;
    if (commerce.paymentCashOnDelivery) setPayment("CASH_ON_DELIVERY");
    else if (commerce.paymentPayAtBusiness) setPayment("PAY_AT_BUSINESS");
  }, [commerce, payment]);

  // ---- delivery quote (debounced on pin change) -------------------------
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!business || fulfillment !== "OWN_DELIVERY" || !pin) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuoting(true);
    quoteTimer.current = setTimeout(() => {
      commerceApi
        .deliveryQuote(business.id, pin.lat, pin.lng)
        .then(setQuote)
        .catch(() => setQuote(null))
        .finally(() => setQuoting(false));
    }, 400);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [business, fulfillment, pin]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPin({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => {},
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  const deliveryFee = fulfillment === "OWN_DELIVERY" && quote?.deliverable ? quote.deliveryFee ?? 0 : 0;
  const total = subtotal + deliveryFee;
  const belowMin =
    fulfillment === "OWN_DELIVERY" &&
    quote?.deliverable &&
    quote.minimumOrderAmount != null &&
    subtotal < quote.minimumOrderAmount;

  const canPlace = useMemo(() => {
    if (!fulfillment || !payment || !name.trim() || !phone.trim() || count === 0) return false;
    if (fulfillment === "OWN_DELIVERY") {
      if (!address.trim() || !pin) return false;
      if (!quote?.deliverable) return false;
      if (belowMin) return false;
    }
    return true;
  }, [fulfillment, payment, name, phone, count, address, pin, quote, belowMin]);

  async function placeOrder() {
    if (!business || !cart || !fulfillment || !payment) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const order = await orderApi.place(business.id, {
        fulfillmentType: fulfillment,
        paymentMethod: payment,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        deliveryAddress: fulfillment === "OWN_DELIVERY" ? address.trim() : null,
        deliveryLat: fulfillment === "OWN_DELIVERY" ? pin?.lat ?? null : null,
        deliveryLng: fulfillment === "OWN_DELIVERY" ? pin?.lng ?? null : null,
        customerNote: note.trim() || null,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      });
      clearCart();
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setPlaceError(errorMessage(e));
    } finally {
      setPlacing(false);
    }
  }

  // ---- render ----------------------------------------------------------
  if (settingsLoaded && !orderingOn) {
    return <FeatureUnavailable feature="ordering" backHref={`/business/${slug}`} backLabel="Back to the business" />;
  }
  if (loadError) return <ErrorBanner message={loadError} />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-xl font-bold text-ink-900">Log in to check out</h1>
        <p className="mt-2 text-sm text-ink-500">Your cart is saved — sign in to place the order.</p>
        <Button className="mt-5" onClick={openLogin}>
          Log in
        </Button>
      </div>
    );
  }

  if (!cart || (business && cart.businessId !== business.id) || count === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-xl font-bold text-ink-900">Your cart is empty</h1>
        <Link href={`/business/${slug}`} className="mt-4 inline-block text-sm font-semibold text-crimson-700 hover:underline">
          ← Back to the menu
        </Link>
      </div>
    );
  }

  if (!business || !commerce) return <PageSpinner />;

  const orderingLive = commerce.mode === "DIRECT_ORDER" && commerce.orderingEnabled;
  if (!orderingLive || !commerce.acceptingOrders) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-xl font-bold text-ink-900">
          {business.name} isn&apos;t taking orders right now
        </h1>
        {commerce.pauseReason && <p className="mt-2 text-sm text-ink-500">{commerce.pauseReason}</p>}
        <Link href={`/business/${slug}`} className="mt-4 inline-block text-sm font-semibold text-crimson-700 hover:underline">
          ← Back to the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <Link href={`/business/${slug}`} className="text-sm text-ink-500 hover:underline">
        ← {business.name}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink-900">Checkout</h1>

      {/* Items */}
      <section className="mt-5 rounded-2xl border border-ink-100 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Your order</h2>
        <ul className="divide-y divide-ink-100">
          {cart.lines.map((l) => (
            <li key={l.menuItemId} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{l.name}</p>
                <p className="text-xs text-ink-400">
                  {l.compareAtPrice != null && (
                    <span className="mr-1 line-through">{formatTk(l.compareAtPrice)}</span>
                  )}
                  {formatTk(l.price)} each
                </p>
                {l.isBogo && l.quantity >= 2 && (
                  <p className="text-xs font-semibold text-crimson-600">
                    Buy 1 Get 1 applied — {billedQty(l)} of {l.quantity} charged
                  </p>
                )}
                {!l.isBogo && l.compareAtPrice != null && (
                  <p className="text-xs font-semibold text-crimson-600">
                    You save {formatTk((l.compareAtPrice - l.price) * l.quantity)}
                  </p>
                )}
              </div>
              <div className="inline-flex items-center rounded-lg border border-ink-200">
                <button
                  type="button"
                  aria-label="Decrease"
                  onClick={() => setQuantity(l.menuItemId, l.quantity - 1)}
                  className="px-2.5 py-1 text-ink-500 hover:text-ink-900"
                >
                  −
                </button>
                <span className="w-7 text-center text-sm font-semibold">{l.quantity}</span>
                <button
                  type="button"
                  aria-label="Increase"
                  onClick={() => setQuantity(l.menuItemId, l.quantity + 1)}
                  className="px-2.5 py-1 text-ink-500 hover:text-ink-900"
                >
                  +
                </button>
              </div>
              <span className="w-16 text-right text-sm font-semibold text-ink-900">
                {formatTk(l.price * billedQty(l))}
              </span>
              <button
                type="button"
                onClick={() => removeLine(l.menuItemId)}
                className="text-xs text-rose-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Fulfillment */}
      <section className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">How would you like it?</h2>
        <div className="flex flex-wrap gap-2">
          {commerce.pickupEnabled && (
            <FulfillmentChoice
              active={fulfillment === "PICKUP"}
              label="Pickup"
              hint="Collect from the business"
              onClick={() => setFulfillment("PICKUP")}
            />
          )}
          {deliveryAvailable && (
            <FulfillmentChoice
              active={fulfillment === "OWN_DELIVERY"}
              label="Delivery"
              hint="The business delivers"
              onClick={() => setFulfillment("OWN_DELIVERY")}
            />
          )}
        </div>

        {fulfillment === "OWN_DELIVERY" && (
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="addr">Delivery address</Label>
              <Textarea
                id="addr"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / road / area, landmark…"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-400">Drop the pin on your exact location.</p>
              <Button size="sm" variant="ghost" onClick={useMyLocation}>
                📍 Use my current location
              </Button>
            </div>
            {pin && (
              <LeafletLocationPicker
                latitude={pin.lat}
                longitude={pin.lng}
                onChange={(lat, lng) => setPin({ lat, lng })}
              />
            )}

            <div className="rounded-xl bg-sand-50 p-3 text-sm">
              {quoting && <p className="text-ink-400">Checking delivery…</p>}
              {!quoting && quote && quote.deliverable && (
                <div className="space-y-0.5">
                  <p className="font-medium text-ink-900">
                    {quote.zoneName} · {formatTk(quote.deliveryFee ?? 0)} delivery
                  </p>
                  <p className="text-xs text-ink-500">
                    {quote.distanceKm} km away
                    {quote.estimatedDeliveryMinutes ? ` · about ${quote.estimatedDeliveryMinutes} min` : ""}
                  </p>
                  {belowMin && (
                    <p className="text-xs font-semibold text-rose-600">
                      Minimum order for delivery is {formatTk(quote.minimumOrderAmount ?? 0)} — add{" "}
                      {formatTk((quote.minimumOrderAmount ?? 0) - subtotal)} more.
                    </p>
                  )}
                </div>
              )}
              {!quoting && quote && !quote.deliverable && (
                <div className="space-y-1">
                  <p className="font-medium text-rose-600">This business doesn&apos;t deliver to your location.</p>
                  <p className="text-xs text-ink-500">
                    Your location: {quote.distanceKm} km away
                    {quote.maxDeliveryKm != null ? ` · max delivery distance ${quote.maxDeliveryKm} km` : ""}
                  </p>
                  {commerce.pickupEnabled && (
                    <Button size="sm" variant="outline" onClick={() => setFulfillment("PICKUP")}>
                      Choose pickup instead
                    </Button>
                  )}
                </div>
              )}
              {!quoting && !quote && <p className="text-ink-400">Set your location to see the delivery fee.</p>}
            </div>
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="note">
            Order note <span className="text-ink-300">(optional)</span>
          </Label>
          <Textarea
            id="note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please don't add too much sauce."
          />
        </div>
      </section>

      {/* Payment */}
      <section className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Payment</h2>
        <div className="space-y-2">
          {commerce.paymentCashOnDelivery && (
            <PaymentChoice
              active={payment === "CASH_ON_DELIVERY"}
              label={paymentMethodLabel("CASH_ON_DELIVERY", fulfillment ?? "OWN_DELIVERY")}
              onClick={() => setPayment("CASH_ON_DELIVERY")}
            />
          )}
          {commerce.paymentPayAtBusiness && (
            <PaymentChoice
              active={payment === "PAY_AT_BUSINESS"}
              label={paymentMethodLabel("PAY_AT_BUSINESS", fulfillment ?? "OWN_DELIVERY")}
              onClick={() => setPayment("PAY_AT_BUSINESS")}
            />
          )}
        </div>
      </section>

      {/* Summary */}
      <section className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4">
        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={formatTk(subtotal)} />
          {fulfillment === "OWN_DELIVERY" && <Row label="Delivery fee" value={formatTk(deliveryFee)} />}
          <div className="mt-1 border-t border-ink-100 pt-2">
            <Row label="Total" value={formatTk(total)} bold />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Amounts are confirmed by {business.name} when the order is accepted.
        </p>

        {placeError && (
          <div className="mt-3">
            <ErrorBanner message={placeError} />
          </div>
        )}

        <Button className="mt-3 w-full" onClick={placeOrder} loading={placing} disabled={!canPlace}>
          Place order · {formatTk(total)}
        </Button>
      </section>
    </div>
  );
}

function FulfillmentChoice({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors " +
        (active ? "border-crimson-500 bg-crimson-50" : "border-ink-200 hover:border-ink-300")
      }
    >
      <span className="block text-sm font-semibold text-ink-900">{label}</span>
      <span className="block text-[11px] text-ink-400">{hint}</span>
    </button>
  );
}

function PaymentChoice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors " +
        (active ? "border-crimson-500 bg-crimson-50 font-medium text-ink-900" : "border-ink-200 text-ink-700 hover:border-ink-300")
      }
    >
      <span
        className={
          "flex h-4 w-4 items-center justify-center rounded-full border " +
          (active ? "border-crimson-600" : "border-ink-300")
        }
      >
        {active && <span className="h-2 w-2 rounded-full bg-crimson-600" />}
      </span>
      {label}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-ink-900" : "text-ink-500"}>{label}</span>
      <span className={bold ? "font-bold text-ink-900" : "text-ink-700"}>{value}</span>
    </div>
  );
}
