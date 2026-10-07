"use client";

import { MessageCustomerButton } from "@/components/owner/message-customer-button";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { orderApi } from "@/lib/api";
import { useOwnerBusiness } from "@/lib/owner-business-context";
import {
  canSellDirect,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  OWNER_ORDER_FILTERS,
  formatTk,
  nextOwnerActions,
} from "@/lib/commerce";
import { errorMessage, useToast } from "@/lib/toast-context";
import { timeAgo } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, PageSpinner, Pagination } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export default function OwnerOrdersPage() {
  const { business } = useOwnerBusiness();
  const { show } = useToast();

  const [filter, setFilter] = useState<OrderStatus | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setOrders(null);
    orderApi
      .ownerList(business.id, filter ?? undefined, page, 20)
      .then((res) => {
        setOrders(res.content);
        setTotalPages(res.totalPages);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [business.id, filter, page]);

  useEffect(load, [load]);

  async function act(order: Order, status: OrderStatus) {
    let note: string | undefined;
    if (status === "REJECTED") {
      const r = window.prompt("Reason for rejecting (optional):") ?? "";
      note = r.trim() || undefined;
    }
    setActingId(order.id);
    try {
      const updated = await orderApi.setStatus(order.id, status, note);
      setOrders((prev) => (prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev));
      show(`Order ${updated.orderNumber} → ${ORDER_STATUS_LABELS[updated.status]}`, "success");
    } catch (e) {
      show(errorMessage(e), "error");
    } finally {
      setActingId(null);
    }
  }

  if (!canSellDirect(business.categoryKind)) {
    return (
      <div className="rounded-xl border border-ink-100 bg-white p-6 text-center">
        <p className="text-sm text-ink-500">Direct ordering isn&apos;t available for this business type yet.</p>
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
        <h2 className="font-display text-lg font-semibold text-ink-900">Orders</h2>
        <Button size="sm" variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {OWNER_ORDER_FILTERS.map((f) => (
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

      {!orders ? (
        <PageSpinner />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders here" description="New orders show up under the “New” filter." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const actions = nextOwnerActions(o);
            return (
              <div key={o.id} className="rounded-2xl border border-ink-100 bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{o.orderNumber}</p>
                    <p className="text-xs text-ink-500">{o.customerName}</p>
                    <MessageCustomerButton kind="order" id={o.id} />
                    <p className="text-[11px] text-ink-400">{timeAgo(o.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_TONE[o.status]}`}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </div>

                <ul className="mt-2 space-y-0.5 text-sm text-ink-700">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity} × {i.itemName}{" "}
                      <span className="text-ink-400">({formatTk(i.totalPrice)})</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 text-xs text-ink-500">
                  {FULFILLMENT_LABELS[o.fulfillmentType]}
                  {o.deliveryAddress ? ` · ${o.deliveryAddress}` : ""}
                  {o.deliveryDistanceKm != null ? ` · ${o.deliveryDistanceKm} km` : ""}
                </div>
                {o.customerNote && (
                  <p className="mt-1 rounded-lg bg-sand-50 px-2 py-1 text-xs text-ink-600">“{o.customerNote}”</p>
                )}

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink-100 pt-2">
                  <span className="text-sm">
                    <span className="text-ink-400">Subtotal {formatTk(o.subtotal)}</span>
                    {o.deliveryFee > 0 && <span className="text-ink-400"> · Delivery {formatTk(o.deliveryFee)}</span>}
                    <span className="ml-1 font-bold text-ink-900">Total {formatTk(o.totalAmount)}</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a) => (
                      <Button
                        key={a.status}
                        size="sm"
                        variant={a.destructive ? "ghost" : "outline"}
                        className={a.destructive ? "text-rose-600" : undefined}
                        loading={actingId === o.id}
                        onClick={() => act(o, a.status)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
