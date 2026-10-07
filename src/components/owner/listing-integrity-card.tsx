"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck } from "lucide-react";
import { claimApi, listingApi, uploadFileToPresignedUrl } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { BusinessResponse, VerificationRequestView } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PendingChangeBanner } from "@/components/owner/pending-change-banner";

const METHOD_LABELS: Record<VerificationRequestView["method"], string> = {
  PHONE: "Phone call",
  DOCUMENT: "Document",
  MANUAL: "Manual check",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Owner overview card for listing integrity: the Verified badge (request it by phone call-back or
 * a document, or cancel a request that's still waiting) and, on a verified listing, a protected
 * edit — name, phone, address or category — that's waiting for Jachai's approval. Until approved,
 * the public page keeps the old values.
 *
 * Every failure is shown inline in the card (and as a toast) — a short-lived toast alone is easy to
 * miss, which is how a failed request once looked like "the button does nothing".
 */
export function ListingIntegrityCard({ business }: { business: BusinessResponse }) {
  const { show } = useToast();
  const [history, setHistory] = useState<VerificationRequestView[]>([]);
  const [method, setMethod] = useState<"PHONE" | "DOCUMENT">("PHONE");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listingApi.verificationHistory(business.id).then(setHistory).catch(() => setHistory([]));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [business.id]);

  const waiting = history.find((h) => h.status === "PENDING");
  const lastRejected = history.find((h) => h.status === "REJECTED");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      let documentRef: string | undefined;
      if (method === "DOCUMENT") {
        if (!file) throw new Error("Choose a document (trade licence, utility bill…) to upload.");
        const presigned = await claimApi.documentUploadUrl(file.name);
        await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        documentRef = presigned.objectKey;
      }
      const created = await listingApi.requestVerification(business.id, {
        method,
        note: note.trim() || undefined,
        documentRef,
      });
      // Show the new state straight from the response — no second round-trip needed.
      setHistory((prev) => [created, ...prev.filter((h) => h.id !== created.id)]);
      setNote("");
      setFile(null);
      show("Verification requested — we'll review it shortly.", "success");
    } catch (err) {
      const message = errorMessage(err) || "Couldn't send the request. Please try again.";
      setError(message);
      show(message, "error");
    } finally {
      setSending(false);
    }
  }

  async function cancelRequest(requestId: string) {
    if (cancelling) return;
    setError(null);
    setCancelling(true);
    try {
      const cancelled = await listingApi.cancelVerification(business.id, requestId);
      setHistory((prev) => prev.map((h) => (h.id === cancelled.id ? cancelled : h)));
      show("Verification request cancelled.", "info");
    } catch (err) {
      const message = errorMessage(err) || "Couldn't cancel the request. Please try again.";
      setError(message);
      show(message, "error");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-surface p-4 space-y-3" data-testid="listing-integrity-card">
      <div className="flex items-center gap-2">
        <BadgeCheck size={18} className={business.verified ? "text-brand-700" : "text-ink-300"} aria-hidden />
        <p className="text-sm font-semibold text-ink-900">{business.verified ? "Verified listing" : "Not verified yet"}</p>
      </div>

      <PendingChangeBanner businessId={business.id} />

      {!business.verified && waiting && (
        <p className="text-sm text-ink-700" data-testid="verification-requested">
          Verification requested · {METHOD_LABELS[waiting.method]} · {formatDate(waiting.createdAt)}
          <span className="mx-1.5 text-ink-300" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => cancelRequest(waiting.id)}
            disabled={cancelling}
            className="font-medium text-crimson-700 hover:underline disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel request"}
          </button>
        </p>
      )}

      {!business.verified && !waiting && (
        <form onSubmit={submit} className="space-y-2" data-testid="verification-form">
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
          {error && (
            <p role="alert" className="text-sm text-rose-600" data-testid="verification-error">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" loading={sending}>
            Request verification
          </Button>
        </form>
      )}

      {error && (business.verified || waiting) && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
