"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOwnerBusiness } from "@/lib/owner-business-context";
import { useLanguage } from "@/lib/language-context";
import { DesignStudio } from "@/components/promo/design-studio";
import { PageSpinner } from "@/components/ui/misc";

type Kind = "OFFER" | "MENU_ITEM" | "EVENT" | "GENERAL";

function PromoteInner() {
  const { business } = useOwnerBusiness();
  const { t } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const offerId = params.get("offer");
  const type = params.get("type") as Kind | null;
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-ink-900">{t("promo.studio.title")}</h2>
      <p className="mb-5 mt-0.5 text-sm text-ink-500">{t("promo.studio.subtitle")}</p>
      <DesignStudio
        businessId={business.id}
        initialOfferId={offerId}
        initialKind={type ?? undefined}
        onPosted={(post) => {
          if (post.status === "DRAFT") router.push(`/owner/${business.id}/promotions`);
        }}
      />
    </div>
  );
}

/** Owner → Promote: the Auto Design Studio (`?offer=<id>` / `?type=EVENT` preselect what to promote). */
export default function OwnerPromotePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <PromoteInner />
    </Suspense>
  );
}
