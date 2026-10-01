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

/**
 * V61: an owner's image from their device, re-encoded in the browser as a JPEG no larger than
 * `maxSide` px — so PNG/WebP/huge phone photos all render reliably on the server and upload fast.
 * Transparent areas become white. Returns the JPEG and the original pixel size.
 */
export async function toJpeg(file: File, maxSide = 2160, quality = 0.9): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be opened as an image."));
      el.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't prepare the image.");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Your browser couldn't prepare the image.");
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
