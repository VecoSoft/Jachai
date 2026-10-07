"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { bookingApi } from "@/lib/api";
import { RoleGate } from "@/components/role-gate";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  formatBookingDate,
  formatBookingTime,
} from "@/lib/commerce";
import { errorMessage, useToast } from "@/lib/toast-context";
import { formatDateTime } from "@/lib/utils";
import type { Booking, QueueStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorBanner, PageSpinner } from "@/components/ui/misc";

const QUEUE_POLL_MS = 30_000;

function BookingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    bookingApi
      .get(id)
      .then(setBooking)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (booking?.status !== "CONFIRMED") {
      setQueue(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      bookingApi
        .queueStatus(id)
        .then((q) => !cancelled && setQueue(q))
        .catch(() => !cancelled && setQueue(null));
    };
    poll();
    const interval = setInterval(poll, QUEUE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, booking?.status]);

  async function cancel() {
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      setBooking(await bookingApi.cancel(id));
      show("Booking cancelled", "success");
    } catch (e) {
      show(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!booking) return <PageSpinner />;

  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/bookings" className="text-sm text-ink-500 hover:underline">
        ← My bookings
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink-900">{booking.bookingNumber}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BOOKING_STATUS_TONE[booking.status]}`}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-ink-400">
        <Link href={`/business/${booking.businessSlug}`} className="hover:underline">
          {booking.businessName}
        </Link>{" "}
        · requested {formatDateTime(booking.createdAt)}
      </p>

      {booking.status === "REJECTED" && booking.rejectionReason && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Rejected: {booking.rejectionReason}
        </p>
      )}

      {queue?.applicable && (
        <p className="mt-3 rounded-lg bg-crimson-50 px-3 py-2.5 text-sm font-medium text-crimson-800">
          {queue.position === 0
            ? "You're up next"
            : `${queue.position} ${queue.position === 1 ? "person" : "people"} ahead of you`}
          {queue.estimatedWaitMinutes != null && queue.estimatedWaitMinutes > 0
            ? ` · estimated wait ~${queue.estimatedWaitMinutes} min`
            : ""}
          {queue.currentlyServingService && (
            <span className="mt-0.5 block text-xs font-normal text-crimson-600">
              Now serving: {queue.currentlyServingService}
            </span>
          )}
        </p>
      )}

      <section className="mt-5 space-y-2 rounded-2xl border border-ink-100 bg-surface p-4 text-sm">
        <Row label="Service" value={booking.serviceName} />
        {booking.staffName && <Row label="Staff" value={booking.staffName} />}
        <Row label="Requested date" value={formatBookingDate(booking.preferredDate)} />
        <Row label="Requested time" value={formatBookingTime(booking.preferredTime)} />
        <Row label="Name" value={booking.customerName} />
      </section>

      {booking.customerNote && (
        <p className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4 text-sm text-ink-600">
          <span className="font-semibold text-ink-800">Your note: </span>
          {booking.customerNote}
        </p>
      )}

      {booking.timeline && booking.timeline.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink-100 bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Progress</p>
          <ol className="space-y-2">
            {booking.timeline.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-crimson-500" />
                <span className="text-ink-700">
                  {BOOKING_STATUS_LABELS[e.toStatus]}
                  {e.note ? ` — ${e.note}` : ""}
                  <span className="ml-1.5 text-xs text-ink-400">{formatDateTime(e.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={load}>
          Refresh
        </Button>
        {canCancel && (
          <Button variant="ghost" className="text-rose-600" onClick={cancel} loading={busy}>
            Cancel booking
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <RoleGate>
      <BookingDetailContent />
    </RoleGate>
  );
}
