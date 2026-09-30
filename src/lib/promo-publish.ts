import { promoApi } from "./api";
import type { CreativeFormat, CreativeView, SavedCreative } from "./types";

/**
 * After a creative is saved: render every format ONCE on the server (/api/promo/render — the live
 * render model, HarfBuzz-shaped text), upload each PNG straight to storage with the pre-signed URL
 * the backend issued, then record the resulting URLs on the creative. Re-run only when the owner
 * changes the creative (each save issues fresh keys, so caches never serve a stale image).
 */
export async function renderAndUpload(saved: SavedCreative): Promise<CreativeView> {
  const keys: Partial<Record<CreativeFormat, string>> = {};
  await Promise.all(
    saved.uploads.map(async (u) => {
      const res = await fetch(`/api/promo/render/${saved.creative.id}?format=${u.format}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't render the ${u.format.toLowerCase()} image (${res.status}).`);
      const png = await res.blob();
      const put = await fetch(u.putUrl, { method: "PUT", body: png, headers: { "Content-Type": "image/png" } });
      if (!put.ok) throw new Error(`Couldn't upload the ${u.format.toLowerCase()} image (${put.status}).`);
      keys[u.format] = u.objectKey;
    })
  );
  return promoApi.markRendered(saved.creative.id, { squareKey: keys.SQUARE!, storyKey: keys.STORY!, ogKey: keys.OG! });
}

/** Save a rendered image to the device (Square / Story downloads). */
export async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}
