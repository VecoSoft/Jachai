"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, Flag, Minus, MoreHorizontal, Store, X } from "lucide-react";
import { cn, focusRing, interactiveTransition } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { initials } from "./chat-utils";

/**
 * 56px sticky chat header — shared by the business-page widget, /me/messages
 * and /owner/inbox. Which controls appear (back/close/minimize/⋯) depends on
 * which callbacks the caller passes: a floating desktop widget gets
 * minimize+close, a full-screen mobile sheet gets back, a permanent inbox
 * pane passes neither and just shows identity.
 */
export function ChatHeader({
  name,
  avatarUrl,
  subtitle,
  verified,
  onBack,
  onClose,
  onMinimize,
  onViewBusiness,
  onReport,
}: {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
  verified?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onViewBusiness?: () => void;
  /** Adds "Report conversation" to the ⋯ menu. */
  onReport?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-100 bg-surface px-3 dark:border-ink-700">
      {onBack && (
        <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Back" className="shrink-0 md:hidden">
          <ArrowLeft size={20} strokeWidth={1.75} />
        </IconButton>
      )}

      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-crimson-600 text-xs font-bold text-white">
            {initials(name)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
          <span className="truncate">{name}</span>
          {verified && <BadgeCheck size={14} className="shrink-0 text-brand-600" aria-label="Verified business" />}
        </p>
        {subtitle && <p className="truncate text-xs text-ink-400">{subtitle}</p>}
      </div>

      {onMinimize && (
        <IconButton variant="ghost" size="sm" onClick={onMinimize} aria-label="Minimize" className="shrink-0">
          <Minus size={18} strokeWidth={1.75} />
        </IconButton>
      )}
      {onClose && (
        <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="shrink-0">
          <X size={18} strokeWidth={1.75} />
        </IconButton>
      )}

      {(onViewBusiness || onReport) && (
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={18} strokeWidth={1.75} />
          </IconButton>
          <div
            role="menu"
            className={cn(
              "absolute right-0 top-full z-20 mt-1 w-44 origin-top-right rounded-lg border border-ink-100 bg-surface p-1 shadow-pop dark:border-ink-700",
              menuOpen ? "block animate-scale-in" : "hidden"
            )}
          >
            {onViewBusiness && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onViewBusiness();
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800",
                interactiveTransition,
                focusRing
              )}
            >
              <Store size={15} />
              View business
            </button>
            )}
            {onReport && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onReport();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-500/10",
                  interactiveTransition,
                  focusRing
                )}
              >
                <Flag size={15} />
                Report conversation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
