"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, Pause, Play, Rocket, Trash2 } from "lucide-react";
import { promoApi } from "@/lib/api";
import { useOwnerBusiness } from "@/lib/owner-business-context";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import type { BoostView, CommunityPostResponse, PromoAnalytics, PromoEventType } from "@/lib/types";
import { BoostSheet } from "@/components/promo/boost-sheet";
import { PromoTrendChart } from "@/components/promo/promo-trend-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, EmptyState, ErrorBanner } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";

const EVENT_ORDER: PromoEventType[] = ["IMPRESSION", "CLICK", "PROFILE_VISIT", "CALL", "DIRECTIONS", "MESSAGE", "ORDER", "BOOKING", "OFFER_CLAIM", "SHARE"];

const STATUS_TONE: Record<string, "brand" | "gold" | "rose" | "neutral"> = {
  PUBLISHED: "brand",
  ACTIVE: "brand",
  PENDING_REVIEW: "gold",
  PENDING_PAYMENT: "gold",
  PAUSED: "gold",
  DRAFT: "neutral",
  EXPIRED: "neutral",
  ENDED: "neutral",
  REJECTED: "rose",
  REMOVED: "rose",
  REFUNDED: "rose",
};

/** Owner → Promotions: what each business post and boost delivered, plus boost / pause / publish actions. */
export default function OwnerPromotionsPage() {
  const { business } = useOwnerBusiness();
  const { t, lang } = useLanguage();
  const { show } = useToast();
  const [analytics, setAnalytics] = useState<PromoAnalytics | null>(null);
  const [posts, setPosts] = useState<CommunityPostResponse[] | null>(null);
  const [boosts, setBoosts] = useState<BoostView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([promoApi.analytics(business.id, days), promoApi.myPosts(business.id), promoApi.boosts(business.id)])
      .then(([a, p, b]) => {
        setAnalytics(a);
        setPosts(p);
        setBoosts(b);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [business.id, days]);
  useEffect(load, [load]);

  const num = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-IN");
  const money = (n: number | null | undefined) => (n == null ? "—" : `৳${Number(n).toLocaleString(lang === "bn" ? "bn-BD" : "en-IN")}`);

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    try {
      await fn();
      show(done, "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">{t("promo.analytics.title")}</h2>
        <p className="text-sm text-ink-500">{t("promo.analytics.subtitle")}</p>
      </div>
      <Link href={`/owner/${business.id}/promote`} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full bg-crimson-600 px-4 text-sm font-semibold text-white hover:bg-crimson-700", focusRing)}>
        <Megaphone size={16} /> {t("promo.analytics.new_promotion")}
      </Link>
    </div>
  );

  if (!analytics || !posts) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const h = analytics.headline;
  const convLabel = (e: string) => t(`promo.analytics.event_${e}`);

  return (
    <div className="space-y-5">
      {header}

      {posts.length === 0 ? (
        <EmptyState
          title={t("promo.analytics.empty_title")}
          description={t("promo.analytics.empty_desc")}
          action={
            <Link href={`/owner/${business.id}/promote?type=OFFER`} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full bg-crimson-600 px-4 text-sm font-semibold text-white", focusRing)}>
              {t("promo.analytics.promote_first")} <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <>
          {h && (
            <div className="rounded-2xl bg-ink-900 p-5 text-white">
              <p className="text-sm text-white/70">{t("promo.analytics.headline_intro", { title: h.title })}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 font-display text-xl font-bold sm:text-2xl">
                <span>{num(h.views)} {t("promo.analytics.views").toLowerCase()}</span>
                <ArrowRight size={18} className="text-white/60" />
                <span>{num(h.clicks)} {t("promo.analytics.clicks").toLowerCase()}</span>
                <ArrowRight size={18} className="text-white/60" />
                <span>{num(h.conversions)} {convLabel(h.conversionEvent).toLowerCase()}</span>
              </p>
            </div>
          )}

          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", days === d ? "bg-crimson-50 text-crimson-700 dark:bg-crimson-900/40 dark:text-crimson-300" : "text-ink-500 hover:bg-ink-50")}
              >
                {t("promo.analytics.last_days", { n: d })}
              </button>
            ))}
          </div>

          <PromoTrendChart daily={analytics.daily} />

          <p className="text-xs text-ink-500">{t("promo.analytics.remaining_week", { n: analytics.postsRemainingThisWeek })}</p>

          <ul className="space-y-3">
            {posts.map((post) => {
              const item = analytics.items.find((i) => i.postId === post.id);
              const promo = post.promotion;
              const status: string = promo?.status ?? post.status ?? "DRAFT";
              const postBoosts = boosts.filter((b) => b.postId === post.id);
              const openBoost = postBoosts.find((b) => ["PENDING_PAYMENT", "PENDING_REVIEW", "ACTIVE", "PAUSED"].includes(b.status));
              return (
                <li key={post.id} className="rounded-2xl border border-ink-100 bg-surface p-4">
                  <div className="flex gap-3">
                    {promo?.squareUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={promo.squareUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-300">
                        <Megaphone size={20} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{t(`promo.status.${status}`)}</Badge>
                        {promo && <span className="text-xs text-ink-500">{t(`promo.type.${promo.type}`)}</span>}
                      </div>
                      <Link href={`/community/${post.id}`} className="mt-1 line-clamp-2 text-sm font-medium text-ink-900 hover:underline">
                        {item?.title ?? post.title ?? post.body}
                      </Link>
                      {promo?.rejectionReason && <p className="mt-1 text-xs text-rose-600">{promo.rejectionReason}</p>}
                    </div>
                  </div>

                  {item && (
                    <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {EVENT_ORDER.filter((e) => e === "IMPRESSION" || e === "CLICK" || (item.totals[e] ?? 0) > 0).map((e) => (
                        <div key={e} className="rounded-lg bg-ink-50 px-2 py-1.5">
                          <dt className="text-[11px] text-ink-500">{convLabel(e)}</dt>
                          <dd className="text-sm font-semibold tabular-nums text-ink-900">{num(item.totals[e] ?? 0)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {item?.boosts.map((b) => (
                    <div key={b.boostId} className="mt-3 rounded-xl border border-ink-100 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Rocket size={14} className="text-crimson-600" /> {b.packageName}
                          <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{t(`promo.status.${b.status}`)}</Badge>
                        </span>
                        <span className="text-xs text-ink-500">
                          {t("promo.analytics.delivered", { served: num(b.impressionsServed), est: num(b.estImpressions) })}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                        <div className="h-full rounded-full bg-crimson-600" style={{ width: `${Math.min(100, (b.impressionsServed / Math.max(1, b.estImpressions)) * 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-ink-500">
                        {t("promo.analytics.spent", { amount: money(b.paidAmount) })}
                        {b.costPerAction != null && ` · ${t("promo.analytics.cpa", { amount: money(b.costPerAction) })}`}
                      </p>
                    </div>
                  ))}

                  {openBoost?.status === "PENDING_PAYMENT" && <PayBoostInline boost={openBoost} onPaid={load} />}
                  {openBoost?.status === "PENDING_REVIEW" && <p className="mt-2 text-xs text-ink-500">{t("promo.boost.payment_next")}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {promo?.canBoost && !openBoost && (
                      <Button size="sm" className="min-h-11" onClick={() => setBoostPostId(post.id)}>
                        <Rocket size={15} /> {t("promo.boost.cta")}
                      </Button>
                    )}
                    {openBoost?.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" className="min-h-11" loading={busyId === openBoost.id} onClick={() => run(openBoost.id, () => promoApi.pauseBoost(openBoost.id), t("promo.boost.paused"))}>
                        <Pause size={15} /> {t("promo.boost.pause")}
                      </Button>
                    )}
                    {openBoost?.status === "PAUSED" && (
                      <Button size="sm" variant="outline" className="min-h-11" loading={busyId === openBoost.id} onClick={() => run(openBoost.id, () => promoApi.resumeBoost(openBoost.id), t("promo.boost.resumed"))}>
                        <Play size={15} /> {t("promo.boost.resume")}
                      </Button>
                    )}
                    {(status === "DRAFT" || status === "REJECTED") && (
                      <Button size="sm" variant="outline" className="min-h-11" loading={busyId === post.id} onClick={() => run(post.id, () => promoApi.publishPost(post.id), t("promo.studio.posted"))}>
                        {t("promo.analytics.submit")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 text-rose-600"
                      loading={busyId === `del-${post.id}`}
                      onClick={() => {
                        if (confirm(t("promo.analytics.delete_confirm"))) run(`del-${post.id}`, () => promoApi.deletePost(post.id), t("promo.analytics.deleted"));
                      }}
                    >
                      <Trash2 size={15} /> {t("promo.analytics.delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {boostPostId && (
        <BoostSheet
          open={Boolean(boostPostId)}
          onClose={() => {
            setBoostPostId(null);
            load();
          }}
          postId={boostPostId}
          cityName={business.cityName ?? null}
        />
      )}
    </div>
  );
}

/** A boost created earlier but not yet paid: pay from here without restarting the flow. */
function PayBoostInline({ boost, onPaid }: { boost: BoostView; onPaid: () => void }) {
  const { t, lang } = useLanguage();
  const { show } = useToast();
  const options = boost.payment?.options ?? [];
  const [method, setMethod] = useState<"BKASH" | "NAGAD">(options[0]?.method ?? "BKASH");
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);
  if (boost.paymentRef) {
    return <p className="mt-2 text-xs text-ink-500">{t("promo.boost.awaiting_verification", { trx: boost.paymentRef })}</p>;
  }
  if (options.length === 0) {
    return <p className="mt-2 text-xs text-amber-700">{t("promo.boost.payment_not_set_up")}</p>;
  }
  const merchant = options.find((o) => o.method === method)?.merchantNumber;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
      <p className="text-amber-900 dark:text-amber-200">
        {t("promo.boost.pay_instructions", { amount: `৳${Number(boost.priceBdt).toLocaleString(lang === "bn" ? "bn-BD" : "en-IN")}` })}{" "}
        <strong className="font-mono">{merchant}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value as "BKASH" | "NAGAD")} className="min-h-11 rounded-lg border border-ink-200 bg-surface px-2 text-base">
          {options.map((o) => (
            <option key={o.method} value={o.method}>{o.method === "BKASH" ? "bKash" : "Nagad"}</option>
          ))}
        </select>
        <Input value={trx} onChange={(e) => setTrx(e.target.value.toUpperCase())} placeholder={t("promo.boost.trx_id")} className="min-h-11 flex-1 font-mono text-base" />
        <Button
          className="min-h-11"
          loading={busy}
          disabled={trx.trim().length < 6}
          onClick={async () => {
            setBusy(true);
            try {
              await promoApi.pay(boost.id, { method, transactionId: trx.trim() });
              show(t("promo.boost.payment_received"), "success");
              onPaid();
            } catch (err) {
              show(errorMessage(err), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("promo.boost.submit_payment")}
        </Button>
      </div>
    </div>
  );
}
