"use client";

import { useState, type FormEvent } from "react";
import { messageApi } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import type { ChatReportReason } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const REASONS: { value: ChatReportReason; label: string }[] = [
  { value: "HARASSMENT", label: "Harassment or threats" },
  { value: "SCAM", label: "Scam or fraud" },
  { value: "SPAM", label: "Spam" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "OTHER", label: "Something else" },
];

/**
 * Report a conversation (chat ⋯ menu). Chats are private — Jachai's moderators can read this
 * conversation only because it was reported.
 */
export function ReportConversationModal({
  threadId,
  otherPartyName,
  open,
  onClose,
}: {
  threadId: string;
  otherPartyName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { show } = useToast();
  const [reason, setReason] = useState<ChatReportReason | "">("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason || sending) {
      if (!reason) setError("Pick a reason.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await messageApi.reportThread(threadId, reason, details.trim() || undefined);
      show("Reported. Our team will review this conversation.", "success");
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      setError(errorMessage(err) || "Couldn't send the report. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="report-conversation-title" panelClassName="max-w-md">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <h2 id="report-conversation-title" className="font-display text-lg font-bold text-ink-900">
            Report conversation
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Your chat with {otherPartyName} is private. Reporting lets Jachai&apos;s moderators read it to check what happened.
          </p>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Reason</legend>
          {REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
              <input
                type="radio"
                name="chat-report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-crimson-600"
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={sending} disabled={sending}>
            Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
