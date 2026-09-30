"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { CreativeFormat, PromoRenderModel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FORMAT_SIZE, PromoCreative } from "./templates";

/**
 * Live HTML preview of a creative — the very same template tree the PNG renderer draws, scaled down
 * with a CSS transform, so what the owner sees is what gets posted. Uses the browser's own text
 * shaping (correct for Bangla); the PNG renderer uses HarfBuzz for the same result.
 */
export function CreativePreview({
  model,
  format = "SQUARE",
  width,
  className,
  showExpired = false,
}: {
  model: PromoRenderModel;
  format?: CreativeFormat;
  /** Rendered width in CSS px; height follows the format's aspect ratio. */
  width: number;
  className?: string;
  showExpired?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!model.showQr || !model.shareUrl) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(model.shareUrl, { margin: 1, width: 240 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [model.showQr, model.shareUrl]);

  const size = FORMAT_SIZE[format];
  const scale = width / size.width;
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-xl bg-white shadow-card", className)}
      style={{ width, height: size.height * scale }}
      aria-hidden
    >
      <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: "'Hind Siliguri', system-ui, sans-serif" }}>
        <PromoCreative model={model} format={format} qrDataUrl={qr} showExpired={showExpired} />
      </div>
    </div>
  );
}

/** A preview that fills its container's width (capped at `maxWidth`), for responsive layouts. */
export function FluidCreativePreview({
  model,
  format = "SQUARE",
  maxWidth = 576,
  showExpired = false,
}: {
  model: PromoRenderModel;
  format?: CreativeFormat;
  maxWidth?: number;
  showExpired?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(maxWidth, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);
  return (
    <div ref={ref} className="w-full">
      <CreativePreview model={model} format={format} width={width} showExpired={showExpired} />
    </div>
  );
}
