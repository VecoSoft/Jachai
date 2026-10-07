"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notificationApi } from "@/lib/api";
import { RoleGate } from "@/components/role-gate";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, formatDateTime } from "@/lib/utils";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/config";
import type { Notification } from "@/lib/types";
import { Badge, EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

function NotificationsContent() {
  const { show } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: number) => {
    setLoading(true);
    setError(null);
    notificationApi
      .list(p, 20)
      .then((res) => {
        setItems(res.notifications.content);
        setTotalPages(res.notifications.totalPages);
        setUnreadCount(res.unreadCount);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(0), [load]);

  async function markRead(n: Notification) {
    if (n.status === "READ") return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, status: "READ" as const } : i)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationApi.markRead(n.id);
    } catch (err) {
      show(errorMessage(err), "error");
      load(page);
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((i) => ({ ...i, status: "READ" as const })));
      setUnreadCount(0);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="mt-1 text-sm text-ink-500">
            Updates on reports you've filed and anything affecting your own reviews or listings.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {loading && <PageSpinner />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && items.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No notifications yet"
            description="You'll see updates here when something you've reported gets reviewed, or if one of your own reviews or listings is flagged."
          />
        </div>
      )}

      <div className="mt-4 divide-y divide-ink-50 rounded-xl border border-ink-100 bg-surface shadow-card overflow-hidden">
        {!loading &&
          !error &&
          items.map((n) => {
            const unread = n.status !== "READ";
            const rowClass = cn(
              "block w-full text-left px-4 py-3.5 hover:bg-ink-50 transition-colors",
              unread && "bg-crimson-50/40"
            );
            const inner = (
              <div className="flex items-start gap-3">
                {unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-crimson-600 flex-none" aria-hidden />}
                <div className={cn("flex-1 min-w-0", !unread && "pl-5")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                    <Badge tone="neutral">{NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}</Badge>
                    {n.channel === "SMS" && <Badge tone="gold">SMS</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{n.body}</p>
                  <p className="mt-1.5 text-xs text-ink-400">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            );

            // Order/booking notifications deep-link to the order/booking (visible to
            // both the customer and the business owner); everything else marks read.
            if (n.relatedEntityType === "ORDER" && n.relatedEntityId) {
              return (
                <Link key={n.id} href={`/orders/${n.relatedEntityId}`} onClick={() => markRead(n)} className={rowClass}>
                  {inner}
                </Link>
              );
            }
            if (n.relatedEntityType === "SUPPORT_TICKET" && n.relatedEntityId) {
              return (
                <Link key={n.id} href={`/help/support/${n.relatedEntityId}`} onClick={() => markRead(n)} className={rowClass}>
                  {inner}
                </Link>
              );
            }
            if (n.relatedEntityType === "BOOKING" && n.relatedEntityId) {
              return (
                <Link key={n.id} href={`/bookings/${n.relatedEntityId}`} onClick={() => markRead(n)} className={rowClass}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={n.id} type="button" onClick={() => markRead(n)} className={rowClass}>
                {inner}
              </button>
            );
          })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          setPage(p);
          load(p);
        }}
      />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RoleGate>
      <NotificationsContent />
    </RoleGate>
  );
}
