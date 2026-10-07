"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { supportApi, uploadFileToPresignedUrl } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support";
import type { SupportCategory } from "@/lib/types";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/misc";

const CATEGORIES = Object.keys(SUPPORT_CATEGORY_LABELS) as SupportCategory[];
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

function ContactForm() {
  const router = useRouter();
  const { show } = useToast();
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (!category) {
      setError("Pick what your question is about.");
      return;
    }
    setSending(true);
    try {
      let screenshotUrl: string | undefined;
      if (file) {
        const presigned = await supportApi.requestUploadUrl(file.name);
        const ok = await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        if (!ok) throw new Error("The screenshot didn't upload. Try again, or send without it.");
        screenshotUrl = presigned.cdnUrlAfterUpload;
      }
      const ticket = await supportApi.open({ category, subject: subject.trim(), message: message.trim(), screenshotUrl });
      show("Sent — we'll reply here in the app.", "success");
      router.push(`/help/support/${ticket.id}`);
    } catch (err) {
      setError(errorMessage(err) || "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/help" className="text-sm text-ink-500 hover:underline">
        ← Help
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">Contact support</h1>
      <p className="mt-1 text-sm text-ink-500">Tell us what happened. We reply in the app — you&apos;ll get a notification.</p>

      <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-ink-100 bg-surface p-5">
        {error && <ErrorBanner message={error} />}
        <fieldset>
          <legend className="text-sm font-semibold text-ink-900">What is it about?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label
                key={c}
                className={
                  "cursor-pointer rounded-full border px-3 py-1.5 text-sm " +
                  (category === c ? "border-crimson-600 bg-crimson-50 text-crimson-700" : "border-ink-200 text-ink-700 hover:border-ink-300")
                }
              >
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  className="sr-only"
                />
                {SUPPORT_CATEGORY_LABELS[c]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="support-subject" className="text-sm font-semibold text-ink-900">
            Subject
          </label>
          <input
            id="support-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
            required
            placeholder="e.g. My order was marked delivered but never arrived"
            className="mt-1.5 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900"
          />
        </div>

        <div>
          <label htmlFor="support-message" className="text-sm font-semibold text-ink-900">
            Message
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            required
            rows={6}
            placeholder="Order or booking number, what you expected, what happened instead…"
            className="mt-1.5 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-ink-900">
            Screenshot <span className="font-normal text-ink-500">(optional — only you and Jachai staff can see it)</span>
          </p>
          {file ? (
            <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-700">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-ink-500 hover:text-ink-900" aria-label="Remove screenshot">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-700 hover:border-ink-400">
              <ImagePlus size={16} aria-hidden />
              Add a screenshot
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_SCREENSHOT_BYTES) {
                    setError("That image is too large (8 MB max).");
                    return;
                  }
                  setFile(f);
                }}
              />
            </label>
          )}
        </div>

        <Button type="submit" loading={sending} disabled={sending}>
          Send to support
        </Button>
      </form>
    </div>
  );
}

export default function ContactSupportPage() {
  return (
    <RoleGate>
      <ContactForm />
    </RoleGate>
  );
}
