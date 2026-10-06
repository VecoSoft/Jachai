"use client";

import { useEffect, useState } from "react";
import { catalogApi, commerceApi } from "@/lib/api";
import type { PublicCommerceView, ServiceOffering, ServiceSection } from "@/lib/types";
import { errorMessage } from "@/lib/toast-context";
import { EmptyState, PageSpinner } from "./ui/misc";
import { Button } from "./ui/button";
import { BookingModal } from "./booking-modal";
import { usePlatformFeatures } from "@/lib/community-settings";

/**
 * Public showcase for the ServiceOffering list — services (GENERAL/SALON/CLINIC),
 * gym membership plans (section OFFERING), or gym facilities (section FACILITY,
 * rendered as a plain chip list since those have no price). Fetches on mount, so
 * the parent should only render it once its tab is opened.
 *
 * When the business has turned on Phase C booking (Salon & Beauty today),
 * each OFFERING row also gets a "Book appointment" button that opens
 * <BookingModal/> — the same request/confirm flow as everywhere else in
 * commerce, no separate booking system.
 */
export function BusinessServiceShowcase({
  businessId,
  businessName,
  section = "OFFERING",
  heading,
}: {
  businessId: string;
  businessName: string;
  section?: ServiceSection;
  heading: string;
}) {
  // Hooks must run before the early returns below (admin "Bookings" feature flag).
  const bookingsOn = usePlatformFeatures().bookingsEnabled;
  const [items, setItems] = useState<ServiceOffering[] | null>(null);
  const [commerce, setCommerce] = useState<PublicCommerceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingFor, setBookingFor] = useState<ServiceOffering | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .services(businessId, section)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    commerceApi
      .publicSettings(businessId)
      .then((c) => !cancelled && setCommerce(c))
      .catch(() => !cancelled && setCommerce(null));
    return () => {
      cancelled = true;
    };
  }, [businessId, section]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!items) return <PageSpinner />;
  if (items.length === 0) return <EmptyState title="Nothing listed here yet" />;

  if (section === "FACILITY") {
    return (
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">{heading}</h2>
        <div className="flex flex-wrap gap-2">
          {items.map((f) => (
            <span key={f.id} className="rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-700">
              {f.name}
            </span>
          ))}
        </div>
      </section>
    );
  }

  const bookingLive =
    bookingsOn && commerce?.mode === "BOOKING" && commerce.bookingEnabled && commerce.acceptingOrders !== false;
  const paused = commerce?.mode === "BOOKING" && commerce.bookingEnabled && commerce.acceptingOrders === false;

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">{heading}</h2>

      {paused && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
          This business is not accepting new bookings right now
          {commerce?.pauseReason ? ` — ${commerce.pauseReason}` : ""}. You can still browse.
        </p>
      )}

      <ul className="divide-y divide-ink-100">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{s.name}</p>
              {s.description && <p className="mt-0.5 text-sm text-ink-500">{s.description}</p>}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                {s.priceText && <p className="text-sm font-medium text-ink-700">{s.priceText}</p>}
                {s.durationMinutes != null && <p className="text-xs text-ink-400">~{s.durationMinutes} min</p>}
              </div>
            </div>
            {bookingLive && (
              <Button size="sm" className="flex-none" onClick={() => setBookingFor(s)}>
                Book appointment
              </Button>
            )}
          </li>
        ))}
      </ul>

      <BookingModal
        open={!!bookingFor}
        onClose={() => setBookingFor(null)}
        businessId={businessId}
        businessName={businessName}
        service={bookingFor}
      />
    </section>
  );
}
