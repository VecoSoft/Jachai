// Server-side PNG rendering of creatives (V58) — imported only by the Node.js route handlers under
// src/app/api/promo. Satori lays out the template (the same one the Studio previews), HarfBuzz shapes
// every text run (src/lib/promo-shaper.ts — correct Bangla conjuncts), resvg rasterizes the SVG.
//
// Why not next/og's ImageResponse: in Next 14.2 its Node build crashes on Windows (it resolves its
// bundled fallback font with path.join() on a file: URL), its Edge build can't run HarfBuzz (no
// runtime WebAssembly compilation on Edge), and Satori alone can't shape Indic scripts. next/og is
// Satori + resvg underneath; this uses the same two engines directly, plus a real shaper.
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import satori from "satori";
import { FORMAT_SIZE, PROMO_FONT_FAMILY, PromoCreative } from "@/components/promo/templates";
import { fontFile, getShaper } from "@/lib/promo-shaper";
import type { CreativeFormat, PromoRenderModel } from "@/lib/types";

let satoriFont: Buffer | null = null;

export function isFormat(v: string | null): v is CreativeFormat {
  return v === "SQUARE" || v === "STORY" || v === "OG";
}

export async function renderCreativePngBuffer(
  model: PromoRenderModel,
  format: CreativeFormat,
  opts: { showExpired?: boolean } = {}
): Promise<Buffer> {
  const shape = await getShaper();
  // All text arrives pre-shaped as images; Satori still requires one font to be registered.
  satoriFont ??= fontFile(400);
  const qr = model.showQr && model.shareUrl ? await QRCode.toDataURL(model.shareUrl, { margin: 1, width: 360, errorCorrectionLevel: "M" }) : null;
  const { width, height } = FORMAT_SIZE[format];
  const svg = await satori(
    <PromoCreative model={model} format={format} qrDataUrl={qr} showExpired={opts.showExpired} shape={shape} />,
    { width, height, fonts: [{ name: PROMO_FONT_FAMILY, data: satoriFont, weight: 400, style: "normal" }] }
  );
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();
}

export async function renderCreativePng(
  model: PromoRenderModel,
  format: CreativeFormat,
  opts: { showExpired?: boolean; cacheSeconds?: number } = {}
): Promise<Response> {
  const png = await renderCreativePngBuffer(model, format, opts);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${opts.cacheSeconds ?? 60}, stale-while-revalidate=300`,
    },
  });
}

/** Backend base URL for server-side fetches (same env var as the browser client). */
export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL)?.replace(/\/$/, "") || "http://localhost:8085";
}
