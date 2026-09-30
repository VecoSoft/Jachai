"use client";

import { useEffect, useState } from "react";
import { Copy, Globe, MessageCircle, Share2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { trackPromo } from "@/lib/promo-session";
import { useToast } from "@/lib/toast-context";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";

/**
 * Share a business post's public page (/p/<postId>). Each channel tags the link with its own ref
 * (?ref=wa | fb | share) so the resulting visits/claims/orders are attributed to the channel.
 */
export function ShareBar({
  postId,
  text,
  boostId = null,
  className,
}: {
  postId: string;
  /** Pre-filled message for WhatsApp / native share (e.g. the caption). */
  text: string;
  boostId?: string | null;
  className?: string;
}) {
  const { t } = useLanguage();
  const { show } = useToast();
  const [canNativeShare, setCanNativeShare] = useState(false);
  // Origin is read after mount so server and first client render produce the same hrefs.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setOrigin(window.location.origin);
  }, []);

  const link = (ref: string) => `${origin}/p/${postId}?ref=${ref}`;
  const track = (ref: string) => trackPromo("SHARE", { postId, boostId, source: "SHARE_LINK", ref });

  const btn = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-200 px-4 text-sm font-medium text-ink-800 hover:bg-ink-50",
    focusRing,
    interactiveTransition
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a
        className={btn}
        href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${link("wa")}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("wa")}
      >
        <MessageCircle size={16} className="text-emerald-600" /> {t("promo.share_whatsapp")}
      </a>
      <a
        className={btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link("fb"))}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("fb")}
      >
        <Globe size={16} className="text-blue-600" /> {t("promo.share_facebook")}
      </a>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          track("share");
          try {
            await navigator.clipboard.writeText(link("share"));
            show(t("promo.link_copied"), "success");
          } catch {
            show(link("share"), "info");
          }
        }}
      >
        <Copy size={16} /> {t("promo.copy_link")}
      </button>
      {canNativeShare && (
        <button
          type="button"
          className={btn}
          onClick={() => {
            track("share");
            navigator.share({ text, url: link("share") }).catch(() => {});
          }}
        >
          <Share2 size={16} /> {t("promo.share")}
        </button>
      )}
    </div>
  );
}
