"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, Rocket } from "lucide-react";
import { promoApi, referenceApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import type { Area, BoostPackageInfo, BoostView, PaymentOption } from "@/lib/types";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { Input, Label } from "../ui/field";
import { Sheet } from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";

type Step = "package" | "targeting" | "summary" | "payment" | "done";

function todayDhaka(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

/**
 * Boost a published business post (V58): package → targeting (areas OR a radius around the
 * business) → start date → summary → manual bKash/Nagad payment with the transaction id. The
 * boost only goes live after an admin verifies the payment (and a moderator approves, if required).
 */
export function BoostSheet({
  open,
  onClose,
  postId,
  cityName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  /** The business's city — areas offered for targeting come from it. */
  cityName: string | null;
  onCreated?: (boost: BoostView) => void;
}) {
  const { t, lang } = useLanguage();
  const { show } = useToast();
  const [step, setStep] = useState<Step>("package");
  const [packages, setPackages] = useState<BoostPackageInfo[] | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [pkg, setPkg] = useState<BoostPackageInfo | null>(null);
  const [mode, setMode] = useState<"areas" | "radius">("radius");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(5);
  const [startDate, setStartDate] = useState(todayDhaka());
  const [boost, setBoost] = useState<BoostView | null>(null);
  const [method, setMethod] = useState<"BKASH" | "NAGAD">("BKASH");
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("package");
    setBoost(null);
    setTrx("");
    promoApi
      .packages()
      .then((res) => {
        setPackages(res.packages);
        setPaymentOptions(res.paymentOptions);
        if (res.paymentOptions[0]) setMethod(res.paymentOptions[0].method);
      })
      .catch((err) => show(errorMessage(err), "error"));
    referenceApi
      .cities()
      .then((cities) => {
        const city = cities.find((c) => c.name === cityName) ?? cities[0];
        return city ? referenceApi.areas(city.id) : [];
      })
      .then(setAreas)
      .catch(() => setAreas([]));
  }, [open, cityName, show]);

  const money = (n: number) => `৳${Number(n).toLocaleString(lang === "bn" ? "bn-BD" : "en-IN")}`;
  const targetingValid = mode === "areas" ? areaIds.length > 0 : Boolean(radius);

  async function createBoost() {
    if (!pkg) return;
    setBusy(true);
    try {
      const b = await promoApi.createBoost(postId, {
        packageId: pkg.id,
        targetAreaIds: mode === "areas" ? areaIds : null,
        radiusKm: mode === "radius" ? radius : null,
        startDate,
      });
      setBoost(b);
      setStep("payment");
      onCreated?.(b);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!boost) return;
    setBusy(true);
    try {
      const b = await promoApi.pay(boost.id, { method, transactionId: trx.trim() });
      setBoost(b);
      setStep("done");
      onCreated?.(b);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const primary =
    step === "package" ? (
      <Button className="min-h-11 w-full" disabled={!pkg} onClick={() => setStep("targeting")}>{t("promo.boost.next")}</Button>
    ) : step === "targeting" ? (
      <Button className="min-h-11 w-full" disabled={!targetingValid} onClick={() => setStep("summary")}>{t("promo.boost.next")}</Button>
    ) : step === "summary" ? (
      <Button className="min-h-11 w-full" loading={busy} onClick={createBoost}>{t("promo.boost.continue_to_payment")}</Button>
    ) : step === "payment" ? (
      <Button className="min-h-11 w-full" loading={busy} disabled={trx.trim().length < 6 || paymentOptions.length === 0} onClick={pay}>
        {t("promo.boost.submit_payment")}
      </Button>
    ) : (
      <Button className="min-h-11 w-full" onClick={onClose}>{t("promo.boost.close")}</Button>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="boost-heading"
      panelClassName="max-w-lg"
      footer={
        <div className="sticky bottom-0 border-t border-ink-100 bg-surface px-5 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {primary}
        </div>
      }
    >
      <div className="max-h-[75vh] overflow-y-auto p-5">
        <h2 id="boost-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          <Rocket size={18} className="text-crimson-600" /> {t("promo.boost.title")}
        </h2>
        <p className="mt-1 text-xs text-ink-500">{t("promo.boost.trust_note")}</p>

        {step === "package" && (
          <div className="mt-4 space-y-2">
            {!packages && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            {packages?.length === 0 && <p className="text-sm text-ink-500">{t("promo.boost.no_packages")}</p>}
            {packages?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPkg(p)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-xl border p-3 text-left",
                  focusRing,
                  pkg?.id === p.id ? "border-crimson-500 bg-crimson-50 dark:bg-crimson-900/30" : "border-ink-200 hover:border-ink-300"
                )}
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{p.name}</span>
                  <span className="text-xs text-ink-500">
                    {t("promo.boost.package_line", { days: p.durationDays, views: p.estImpressions.toLocaleString(lang === "bn" ? "bn-BD" : "en-IN") })}
                  </span>
                </span>
                <span className="text-base font-bold text-ink-900">{money(p.priceBdt)}</span>
              </button>
            ))}
          </div>
        )}

        {step === "targeting" && pkg && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Chip size="md" active={mode === "radius"} onClick={() => setMode("radius")}>{t("promo.boost.around_business")}</Chip>
              <Chip size="md" active={mode === "areas"} onClick={() => setMode("areas")}>{t("promo.boost.pick_areas")}</Chip>
            </div>
            {mode === "radius" ? (
              <div className="flex flex-wrap gap-2">
                {[2, 5, 10].filter((r) => r <= pkg.maxRadiusKm).map((r) => (
                  <Chip key={r} size="md" active={radius === r} onClick={() => setRadius(r)}>
                    <MapPin size={14} /> {t("promo.boost.km", { n: r })}
                  </Chip>
                ))}
              </div>
            ) : (
              <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                {areas.map((a) => {
                  const on = areaIds.includes(a.id);
                  return (
                    <Chip
                      key={a.id}
                      size="md"
                      active={on}
                      onClick={() => setAreaIds((prev) => (on ? prev.filter((x) => x !== a.id) : prev.length >= 10 ? prev : [...prev, a.id]))}
                    >
                      {on && <Check size={14} />} {a.name}
                    </Chip>
                  );
                })}
              </div>
            )}
            <div>
              <Label htmlFor="boost-start">{t("promo.boost.start_date")}</Label>
              <Input id="boost-start" type="date" min={todayDhaka()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-base" />
            </div>
          </div>
        )}

        {step === "summary" && pkg && (
          <dl className="mt-4 space-y-2 rounded-xl bg-ink-50 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">{t("promo.boost.package")}</dt><dd className="font-medium">{pkg.name}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t("promo.boost.duration")}</dt><dd className="font-medium">{t("promo.boost.days", { n: pkg.durationDays })}</dd></div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">{t("promo.boost.targeting")}</dt>
              <dd className="text-right font-medium">
                {mode === "radius" ? t("promo.boost.within_km", { n: radius }) : areas.filter((a) => areaIds.includes(a.id)).map((a) => a.name).join(", ")}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-ink-500">{t("promo.boost.start_date")}</dt><dd className="font-medium">{startDate}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-2"><dt className="font-semibold">{t("promo.boost.total")}</dt><dd className="text-base font-bold">{money(pkg.priceBdt)}</dd></div>
          </dl>
        )}

        {step === "payment" && boost && (
          <div className="mt-4 space-y-3">
            {paymentOptions.length === 0 ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t("promo.boost.payment_not_set_up")}</p>
            ) : (
              <>
                <p className="text-sm text-ink-700">{t("promo.boost.pay_instructions", { amount: money(boost.priceBdt) })}</p>
                <div className="flex gap-2">
                  {paymentOptions.map((o) => (
                    <Chip key={o.method} size="md" active={method === o.method} onClick={() => setMethod(o.method)}>
                      {o.method === "BKASH" ? "bKash" : "Nagad"}
                    </Chip>
                  ))}
                </div>
                <div className="rounded-xl border border-ink-200 p-3">
                  <p className="text-xs text-ink-500">{t("promo.boost.merchant_number")}</p>
                  <p className="font-mono text-lg font-bold tracking-wide text-ink-900">
                    {paymentOptions.find((o) => o.method === method)?.merchantNumber}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{t("promo.boost.amount")}: <strong>{money(boost.priceBdt)}</strong></p>
                </div>
                <div>
                  <Label htmlFor="trx">{t("promo.boost.trx_id")}</Label>
                  <Input id="trx" value={trx} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTrx(e.target.value.toUpperCase())} className="font-mono text-base" placeholder="9J7D3K2LQX" />
                </div>
              </>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="mt-6 space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"><Check /></div>
            <p className="font-semibold text-ink-900">{t("promo.boost.payment_received")}</p>
            <p className="text-sm text-ink-500">{t("promo.boost.payment_next")}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
