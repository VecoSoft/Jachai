import { NextResponse } from "next/server";
import { TEMPLATE_KEYS, sampleModel } from "@/components/promo/templates";
import { isFormat, renderCreativePng } from "@/lib/promo-render";
import type { PromoTemplateKey } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/promo/sample/{templateKey}?format=SQUARE|STORY|OG&lang=en|bn&variant=normal|long|bare
 * Sample-data render used by the admin "Templates" page previews and the rendering test matrix
 * (Bangla + English, long names, missing photo, missing rating). Contains no real business data.
 */
export async function GET(req: Request, { params }: { params: { key: string } }) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "SQUARE";
  const lang = url.searchParams.get("lang") === "bn" ? "bn" : "en";
  const variant = (["normal", "long", "bare"] as const).find((v) => v === url.searchParams.get("variant")) ?? "normal";
  const key = params.key as PromoTemplateKey;
  if (!TEMPLATE_KEYS.includes(key) || !isFormat(format)) {
    return NextResponse.json({ message: "Unknown template or format" }, { status: 400 });
  }
  return renderCreativePng(sampleModel(key, lang, variant), format, { cacheSeconds: 3600 });
}
