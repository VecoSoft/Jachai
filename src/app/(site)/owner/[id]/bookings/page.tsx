"use client";

import { MessageCustomerButton } from "@/components/owner/message-customer-button";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { bookingApi } from "@/lib/api";
import { useOwnerBusiness } from "@/lib/owner-business-context";
import {
  canBook,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  OWNER_BOOKING_FILTERS,
  formatBookingDate,
  formatBookingTime,
  nextOwnerBookingActions,
} from "@/lib/commerce";
import { errorMessage, useToast } from "@/lib/toast-context";
import { timeAgo } from "@/lib/utils";
import type { Booking, BookingStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export default function OwnerBookingsPage() {
  const { business } = useOwnerBusiness();
  const { show } = useToast();

  const [filter, setFilter] = useState<BookingStatus | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setBookings(null);
    bookingApi
      .ownerList(business.id, filter ?? undefined, page, 20)
      .then((res) => {
        setBookings(res.content);
        setTotalPages(res.totalPages);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [business.id, filter, page]);

  useEffect(load, [load]);

  async function act(booking: Booking, status: BookingStatus) {
    let note: string | undefined;
    if (status === "REJECTED") {
      const r = window.prompt("Reason for rejecting (optional):") ?? "";
      note = r.trim() || undefined;
    }
    setActingId(booking.id);
    try {
      const updated = await bookingApi.setStatus(booking.id, status, note);
      setBookings((prev) => (prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
      show(`Booking ${updated.bookingNumber} → ${BOOKING_STATUS_LABELS[updated.status]}`, "success");
    } catch (e) {
      show(errorMessage(e), "error");
    } finally {
      setActingId(null);
    }
  }

  async function start(booking: Booking) {
    setActingId(booking.id);
    try {
      const updated = await bookingApi.start(booking.id);
      setBookings((prev) => (prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
      show(`${updated.bookingNumber} started`, "success");
    } catch (e) {
      show(errorMessage(e), "error");
    } finally {
      setActingId(null);
    }
  }

  if (!canBook(business.categoryKind)) {
    return (
      <div className="rounded-xl border border-ink-100 bg-white p-6 text-center">
        <p className="text-sm text-ink-500">Appointment booking isn&apos;t available for this business type yet.</p>
        <Link href={`/owner/${business.id}`} className="mt-2 inline-block text-sm font-medium text-crimson-700 hover:underline">
          ← Back to Overview
        </Link>
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">Bookings</h2>
        <Button size="sm" variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {OWNER_BOOKING_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setFilter(f.status);
              setPage(0);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.status
                ? "border-crimson-500 bg-crimson-50 text-crimson-700"
                : "border-ink-200 text-ink-600 hover:border-ink-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!bookings ? (
        <PageSpinner />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings here" description="New requests show up under the “Pending” filter." />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const actions = nextOwnerBookingActions(b);
            return (
              <div key={b.id} className="rounded-2xl border border-ink-100 bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{b.bookingNumber}</p>
                    <p className="text-xs text-ink-500">{b.customerName}</p>
                    <MessageCustomerButton kind="booking" id={b.id} />
                    <p className="text-[11px] text-ink-400">Requested {timeAgo(b.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BOOKING_STATUS_TONE[b.status]}`}>
                    {BOOKING_STATUS_LABELS[b.status]}
                  </span>
                </div>

                <div className="mt-2 text-sm text-ink-700">
                  {b.serviceName}
                  {b.staffName ? ` with ${b.staffName}` : ""}
                </div>
                <div className="mt-0.5 text-xs font-medium text-ink-900">
                  {formatBookingDate(b.preferredDate)} · {formatBookingTime(b.preferredTime)}
                </div>
                {b.customerNote && (
                  <p className="mt-1 rounded-lg bg-sand-50 px-2 py-1 text-xs text-ink-600">“{b.customerNote}”</p>
                )}
                {b.autoConfirmed && b.status === "CONFIRMED" && !b.startedAt && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600">Auto-confirmed</p>
                )}
                {b.startedAt && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600">
                    🟢 In progress · started {timeAgo(b.startedAt)}
                  </p>
                )}

                {(actions.length > 0 || (b.status === "CONFIRMED" && !b.startedAt)) && (
                  <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-ink-100 pt-2">
                    {b.status === "CONFIRMED" && !b.startedAt && (
                      <Button size="sm" variant="outline" loading={actingId === b.id} onClick={() => start(b)}>
                        Start
                      </Button>
                    )}
                    {actions.map((a) => (
                      <Button
                        key={a.status}
                        size="sm"
                        variant={a.destructive ? "ghost" : "outline"}
                        className={a.destructive ? "text-rose-600" : undefined}
                        loading={actingId === b.id}
                        onClick={() => act(b, a.status)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
