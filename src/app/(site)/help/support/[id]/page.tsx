"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Paperclip } from "lucide-react";
import { supportApi } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS, supportStatusTone } from "@/lib/support";
import { cn, formatDateTime } from "@/lib/utils";
import type { SupportTicketDetail } from "@/lib/types";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Badge, ErrorBanner, PageSpinner } from "@/components/ui/misc";

function SupportThread() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supportApi
      .get(id)
      .then(setTicket)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || !reply.trim()) return;
    setSending(true);
    try {
      setTicket(await supportApi.reply(id, reply.trim()));
      setReply("");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!ticket) return <PageSpinner />;

  return (
    <div className="max-w-2xl">
      <Link href="/help" className="text-sm text-ink-500 hover:underline">
        ← Help
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-bold text-ink-900">{ticket.subject}</h1>
        <Badge tone={supportStatusTone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {SUPPORT_CATEGORY_LABELS[ticket.category]} · sent {formatDateTime(ticket.created_at)}
        {ticket.screenshot_url && (
          <span className="ml-2 inline-flex items-center gap-1">
            <Paperclip size={12} aria-hidden /> screenshot attached
          </span>
        )}
      </p>

      <ol className="mt-5 space-y-3">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-xl border p-3 text-sm",
              m.from_staff ? "border-crimson-100 bg-crimson-50/40" : "border-ink-100 bg-surface"
            )}
          >
            <p className="text-xs font-semibold text-ink-500">
              {m.from_staff ? "Jachai support" : "You"} · {formatDateTime(m.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-800">{m.body}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={send} className="mt-5 space-y-2">
        <label htmlFor="support-reply" className="text-sm font-semibold text-ink-900">
          {ticket.status === "RESOLVED" ? "Still need help? Reply to reopen" : "Reply"}
        </label>
        <textarea
          id="support-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900"
        />
        <Button type="submit" size="sm" loading={sending} disabled={sending || !reply.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

export default function SupportThreadPage() {
  return (
    <RoleGate>
      <SupportThread />
    </RoleGate>
  );
}
