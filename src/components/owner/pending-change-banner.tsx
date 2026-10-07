"use client";

import { useCallback, useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { listingApi } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { PendingListingChange } from "@/lib/types";

export const PROTECTED_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  contactNumber: "Phone",
  categoryId: "Category",
  cityId: "City",
  areaId: "Area",
  latitude: "Map pin",
  longitude: "Map pin",
};

/** Human labels of the fields in a pending change ("Map pin" once for lat+lng). */
export function changedLabels(change: PendingListingChange): string[] {
  return Array.from(new Set(change.changedFields.map((f) => PROTECTED_FIELD_LABELS[f] ?? f)));
}

/** "Name → Rahim Store" for text fields; ids and coordinates just say they changed. */
function describe(change: PendingListingChange): string[] {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const field of change.changedFields) {
    const label = PROTECTED_FIELD_LABELS[field] ?? field;
    if (seen.has(label)) continue;
    seen.add(label);
    const value = change.after[field];
    if ((field === "name" || field === "contactNumber") && typeof value === "string" && value) {
      parts.push(`${label} → ${value}`);
    } else if (label === "Map pin") {
      parts.push("Map pin moved");
    } else {
      parts.push(`${label} changed`);
    }
  }
  return parts;
}

/**
 * "Waiting for approval: Name → <new> · Cancel" — shown on the owner's edit form and overview
 * while a protected edit on a verified listing waits for review. The owner can withdraw it; the
 * listing then simply keeps its current values.
 */
export function PendingChangeBanner({ businessId, refreshKey = 0 }: { businessId: string; refreshKey?: number }) {
  const { show } = useToast();
  const [change, setChange] = useState<PendingListingChange | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    listingApi.pendingChange(businessId).then(setChange).catch(() => setChange(null));
  }, [businessId]);

  useEffect(load, [load, refreshKey]);

  if (!change) return null;

  async function cancel() {
    if (!change || cancelling) return;
    setCancelling(true);
    try {
      await listingApi.cancelPendingChange(businessId, change.id);
      setChange(null);
      show("Change withdrawn — your page keeps its current details.", "info");
    } catch (err) {
      show(errorMessage(err) || "Couldn't cancel the change. Please try again.", "error");
      load();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-ink-700"
      data-testid="pending-change-banner"
    >
      <Hourglass size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="min-w-0">
        <strong className="text-ink-900">Waiting for approval:</strong> {describe(change).join(" · ")}
        <span className="mx-1.5 text-ink-300" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="font-medium text-crimson-700 hover:underline disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel"}
        </button>
        <span className="block text-xs text-ink-500 mt-0.5">
          Your listing is verified, so these details change on the public page only after Jachai approves them.
        </span>
      </p>
    </div>
  );
}
