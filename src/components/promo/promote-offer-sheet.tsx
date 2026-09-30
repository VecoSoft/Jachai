"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { promoApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { renderAndUpload } from "@/lib/promo-publish";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import type { CreativeData, OfferResponse, PromoRenderModel } from "@/lib/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { Sheet } from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { CreativePreview } from "./creative-preview";

/**
 * "Promote this offer in the community?" (V58) — shown right after an offer goes live. An OFFER_BOLD
 * creative and a caption are already prepared from the offer's own data; one tap renders the images
 * and publishes a business post of type OFFER linked to the offer (it expires with the offer).
 */
export function PromoteOfferSheet({ businessId, offer, onClose }: { businessId: string; offer: OfferResponse; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const { show } = useToast();
  const [model, setModel] = useState<PromoRenderModel | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const data: CreativeData = {
    headline: Array.from(offer.title).slice(0, 40).join(""),
    subline: null,
    accentColor: null,
    photoUrl: null,
    offerId: offer.id,
    menuItemId: null,
    eventTitle: null,
    eventStart: null,
    eventEnd: null,
    showRating: true,
    showQr: false,
    showPrice: true,
  };

  useEffect(() => {
    promoApi.previewModel(businessId, { templateKey: "OFFER_BOLD", data }).then(setModel).catch((err) => show(errorMessage(err), "error"));
    promoApi
      .captions(businessId, { type: "OFFER", offerId: offer.id, tone: "friendly" })
      .then((res) => setCaption((lang === "bn" ? res.bn : res.en)[0] ?? ""))
      .catch(() => setCaption(offer.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, offer.id]);

  async function postNow() {
    setBusy(true);
    try {
      const saved = await promoApi.saveCreative(businessId, { templateKey: "OFFER_BOLD", data: { ...data, accentColor: model?.accentColor ?? null } });
      const creative = await renderAndUpload(saved);
      const post = await promoApi.createPost(businessId, {
        type: "OFFER",
        title: null,
        body: caption.trim(),
        creativeId: creative.id,
        offerId: offer.id,
        menuItemId: null,
        eventStart: null,
        eventEnd: null,
        publish: true,
      });
      show(post.status === "PENDING" ? t("promo.studio.waiting_review") : t("promo.studio.posted"), "success");
      onClose();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy="promote-offer-heading"
      panelClassName="max-w-md"
      footer={
        <div className="sticky bottom-0 flex gap-2 border-t border-ink-100 bg-surface px-5 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <Button className="min-h-11 flex-1" loading={busy} disabled={!model || caption.trim().length < 20} onClick={postNow}>
            {t("promo.offer_sheet.post")}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>
            {t("promo.offer_sheet.not_now")}
          </Button>
        </div>
      }
    >
      <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
        <h2 id="promote-offer-heading" className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          <Megaphone size={18} className="text-crimson-600" /> {t("promo.offer_sheet.title")}
        </h2>
        <p className="text-sm text-ink-500">{t("promo.offer_sheet.subtitle")}</p>
        <div className="flex justify-center">{model ? <CreativePreview model={model} width={280} /> : <Skeleton className="h-[280px] w-[280px] rounded-xl" />}</div>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className="text-base" aria-label={t("promo.studio.caption")} />
        <Link href={`/owner/${businessId}/promote?offer=${offer.id}`} className={cn("inline-flex min-h-11 items-center text-sm font-semibold text-crimson-700 hover:underline", focusRing)}>
          {t("promo.offer_sheet.customize")}
        </Link>
      </div>
    </Sheet>
  );
}
