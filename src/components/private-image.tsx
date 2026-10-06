"use client";

import { useEffect, useState } from "react";
import { getStoredAccessToken } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * An image only its uploader may see — a photo still waiting for moderation. The public storage
 * URL answers 404 to requests without the uploader's token, and a plain <img> can't send one,
 * so this fetches the file with the token and shows it from a blob URL. Falls back to a neutral
 * tile if the fetch fails (e.g. the photo was rejected meanwhile).
 */
export function PrivateImage({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    setFailed(false);
    const token = getStoredAccessToken();
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (!alive) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (failed || !objectUrl) {
    return <span className={cn("block bg-ink-100", !failed && "animate-pulse", className)} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={alt} className={className} />;
}
