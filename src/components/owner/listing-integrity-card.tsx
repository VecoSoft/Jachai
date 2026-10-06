"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Hourglass } from "lucide-react";
import { claimApi, listingApi, uploadFileToPresignedUrl } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { BusinessResponse, PendingListingChange, VerificationRequestView } from "@/lib/types";
import { Button } from "@/components/ui/button";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  contactNumber: "Phone",
  categoryId: "Category",
  cityId: "City",
  areaId: "Area",
  latitude: "Map pin",
  longitude: "Map pin",
};

/**
 * Owner overview card for listing integrity: the Verified badge (request it by phone call-back or
 * a document) and, on a verified listing, a protected edit — name, phone, address or category —
 * that's waiting for Jachai's approval. Until approved, the public page keeps the old values.
 */
export function ListingIntegrityCard({ business }: { business: BusinessResponse }) {
  const { show } = useToast();
  const [pending, setPending] = useState<PendingListingChange | null>(null);
  const [history, setHistory] = useState<VerificationRequestView[]>([]);
  const [method, setMethod] = useState<"PHONE" | "DOCUMENT">("PHONE");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  function load() {
    listingApi.pendingChange(business.id).then(setPending).catch(() => setPending(null));
    listingApi.verificationHistory(business.id).then(setHistory).catch(() => setHistory([]));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [business.id]);

  const waiting = history.find((h) => h.status === "PENDING");
  const lastRejected = history.find((h) => h.status === "REJECTED");

  async function submit() {
    setSending(true);
    try {
      let documentRef: string | undefined;
      if (method === "DOCUMENT") {
        if (!file) throw new Error("Choose a document (trade licence, utility bill…) to upload.");
        const presigned = await claimApi.documentUploadUrl(file.name);
        await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        documentRef = presigned.objectKey;
      }
      await listingApi.requestVerification(business.id, { method, note: note.trim() || undefined, documentRef });
      show("Verification requested — we'll review it shortly.", "success");
      setNote("");
      setFile(null);
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  const changedLabels = pending
    ? Array.from(new Set(pending.changedFields.map((f) => FIELD_LABELS[f] ?? f)))
    : [];

  return (
    <div className="rounded-xl border border-ink-100 bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BadgeCheck size={18} className={business.verified ? "text-brand-700" : "text-ink-300"} aria-hidden />
        <p className="text-sm font-semibold text-ink-900">
          {business.verified ? "Verified listing" : "Not verified yet"}
        </p>
      </div>

      {pending && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-ink-700">
          <Hourglass size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p>
            Your change to <strong>{changedLabels.join(", ")}</strong> is waiting for review. Because this listing is
            verified, the public page keeps the current {changedLabels.length > 1 ? "values" : "value"} until it&apos;s approved.
          </p>
        </div>
      )}

      {!business.verified && waiting && (
        <p className="text-sm text-ink-500">
          Verification request ({waiting.method === "PHONE" ? "phone call" : "document"}) sent — we&apos;ll review it soon.
        </p>
      )}

      {!business.verified && !waiting && (
        <div className="space-y-2">
          <p className="text-sm text-ink-500">
            Verified listings get a badge and more trust. Ask us to call your listed number, or upload a document.
          </p>
          {lastRejected?.reason && (
            <p className="text-xs text-rose-600">Last request wasn&apos;t approved: {lastRejected.reason}</p>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="verify-method" checked={method === "PHONE"} onChange={() => setMethod("PHONE")} />
              Phone call
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="verify-method" checked={method === "DOCUMENT"} onChange={() => setMethod("DOCUMENT")} />
              Document
            </label>
          </div>
          {method === "DOCUMENT" && (
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Anything we should know (best time to call, …)"
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900"
          />
          <Button size="sm" onClick={submit} loading={sending}>
            Request verification
          </Button>
        </div>
      )}
    </div>
  );
}
