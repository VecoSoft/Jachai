import { NextResponse } from "next/server";
import { apiBase, isFormat, renderCreativePng } from "@/lib/promo-render";
import type { PromoRenderModel } from "@/lib/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/promo/render/{creativeId}?format=SQUARE|STORY|OG[&expired=1]
 * Renders a saved creative from its LIVE render model (prices, offer terms and rating re-read
 * from the database by the backend on every call). The Studio calls this once per format right
 * after saving and uploads the PNGs to storage; share pages use ?expired=1 for the overlay.
 */
export async function GET(req: Request, { params }: { params: { creativeId: string } }) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "SQUARE";
  if (!UUID.test(params.creativeId) || !isFormat(format)) {
    return NextResponse.json({ message: "Bad creative id or format" }, { status: 400 });
  }
  const res = await fetch(`${apiBase()}/api/v1/promo/public/creatives/${params.creativeId}/render-model`, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ message: "Creative not found" }, { status: res.status === 404 ? 404 : 502 });
  }
  const model = (await res.json()) as PromoRenderModel;
  return renderCreativePng(model, format, { showExpired: url.searchParams.get("expired") === "1", cacheSeconds: 60 });
}
