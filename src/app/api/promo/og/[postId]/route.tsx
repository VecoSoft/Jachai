import { NextResponse } from "next/server";
import { apiBase, renderCreativePng } from "@/lib/promo-render";
import type { PromoRenderModel, PromoSharePayload } from "@/lib/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/promo/og/{postId} — the 1200×630 link-preview image for a shared business post
 * (/p/{postId}). Always rendered live, so an ended offer gets the "Expired" overlay the moment
 * it ends. Posts without a creative get a Minimal card built from the business's own data.
 */
export async function GET(_req: Request, { params }: { params: { postId: string } }) {
  if (!UUID.test(params.postId)) {
    return NextResponse.json({ message: "Bad post id" }, { status: 400 });
  }
  const res = await fetch(`${apiBase()}/api/v1/promo/public/posts/${params.postId}/share`, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }
  const share = (await res.json()) as PromoSharePayload;
  const expired = Boolean(share.post.promotion?.expired);
  const model: PromoRenderModel = share.creative
    ? { ...share.creative, expired: share.creative.expired || expired }
    : {
        templateKey: "MINIMAL",
        businessName: share.business.name,
        logoUrl: share.business.logoUrl ?? null,
        areaName: share.business.areaName ?? null,
        cityName: share.business.cityName ?? null,
        averageRating: share.business.reviewCount > 0 ? share.business.averageRating : null,
        reviewCount: share.business.reviewCount,
        quote: null,
        headline: share.post.title ?? (share.post.body ? Array.from(share.post.body).slice(0, 40).join("") : share.business.name),
        subline: null,
        accentColor: "#C8102E",
        photoUrl: share.business.coverPhotoUrl ?? share.business.photoUrls?.[0] ?? null,
        showRating: false,
        showQr: false,
        showPrice: false,
        offer: null,
        menuItem: null,
        event: null,
        shareUrl: share.shareUrl,
        expired,
      };
  return renderCreativePng(model, "OG", { showExpired: true, cacheSeconds: 120 });
}
