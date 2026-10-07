"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicketSummary } from "@/lib/types";
import { ContentPageView } from "@/components/content-page-view";
import { Badge } from "@/components/ui/misc";
import { buttonVariantClasses } from "@/components/ui/button";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS, supportStatusTone } from "@/lib/support";

function MyRequests() {
  const [items, setItems] = useState<SupportTicketSummary[] | null>(null);

  useEffect(() => {
    supportApi.mine().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-ink-900">Your support requests</h2>
      <ul className="mt-3 divide-y divide-ink-50 rounded-xl border border-ink-100 bg-surface overflow-hidden">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/help/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{t.subject}</p>
                <p className="text-xs text-ink-500">
                  {SUPPORT_CATEGORY_LABELS[t.category]} · updated {formatDateTime(t.updated_at)}
                </p>
              </div>
              {t.staff_replies > 0 && t.status === "PENDING" && <Badge tone="crimson">Reply from Jachai</Badge>}
              <Badge tone={supportStatusTone(t.status)}>{SUPPORT_STATUS_LABELS[t.status]}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HelpPage() {
  const { user } = useAuth();
  return (
    <ContentPageView slug="help">
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-surface p-4">
        <LifeBuoy size={20} className="text-crimson-600" aria-hidden />
        <p className="flex-1 text-sm text-ink-700">Still stuck? Send us a message — we reply right here in the app.</p>
        <Link href="/help/contact" className={buttonVariantClasses.primary + " rounded-lg px-4 py-2 text-sm font-semibold"}>
          Contact support
        </Link>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        <Link href="/faq" className="underline">
          FAQ
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of use
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </p>
      {user && <MyRequests />}
    </ContentPageView>
  );
}
