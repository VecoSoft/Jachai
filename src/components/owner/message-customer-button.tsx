"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { bookingApi, orderApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/lib/toast-context";

/**
 * "Message customer" on the owner's order and booking cards. Customers' phone numbers aren't
 * collected or shared (V70); the business reaches them through in-app chat instead. Opens (or
 * creates) the conversation with this order's / booking's customer in the owner inbox.
 */
export function MessageCustomerButton({ kind, id }: { kind: "order" | "booking"; id: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { threadId } = kind === "order" ? await orderApi.customerChat(id) : await bookingApi.customerChat(id);
      router.push(`/owner/inbox/${threadId}`);
    } catch {
      show(t("owner.message_customer_failed"), "error");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      title={t("owner.message_customer_hint")}
      className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      {t("owner.message_customer")}
    </button>
  );
}
