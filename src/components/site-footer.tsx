"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referenceApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { usePlatformFeatures } from "@/lib/community-settings";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import type { Category, City } from "@/lib/types";

const FOOTER_LINKS = [
  { href: "/help", en: "Help", bn: "সাহায্য" },
  { href: "/faq", en: "FAQ", bn: "প্রশ্নোত্তর" },
  { href: "/terms", en: "Terms", bn: "শর্তাবলী" },
  { href: "/privacy", en: "Privacy", bn: "গোপনীয়তা" },
];

/** Global site footer — categories/cities are the real reference-data lists, not hardcoded copy. */
export function SiteFooter() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const { lang, setLanguage } = useLanguage();
  const { openLogin } = useAuthModal();
  const { user } = useAuth();
  // Maintenance mode: no footer (its lists come from the API, which answers 503 to visitors).
  const maintenanceLocked = usePlatformFeatures().maintenanceMode && user?.role !== "ADMIN";

  useEffect(() => {
    if (maintenanceLocked) return;
    referenceApi.categories().then(setCategories).catch(() => {});
    referenceApi.cities().then(setCities).catch(() => {});
  }, [maintenanceLocked]);

  if (maintenanceLocked) return null;

  return (
    <footer className="border-t border-ink-100 bg-sand-50/60 mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
        <div>
          <h4 className="font-display font-bold text-ink-900 mb-3">Categories</h4>
          <ul className="space-y-2">
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/?categoryId=${c.id}`} className="text-ink-500 hover:text-crimson-700">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-ink-900 mb-3">Cities</h4>
          <ul className="space-y-2">
            {cities.slice(0, 6).map((c) => (
              <li key={c.id} className="text-ink-500">
                {c.name}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-ink-900 mb-3">For businesses</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/owner/new" className="text-ink-500 hover:text-crimson-700">
                List your business
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openLogin}
                className="text-ink-500 hover:text-crimson-700"
              >
                Business owner login
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-ink-900 mb-3">Jachai</h4>
          <p className="text-ink-500 leading-relaxed mb-4">
            Bangladesh&apos;s trust-first local business directory — verified owners, real reviews.
          </p>
          <nav aria-label="Help and policies" className="mb-4 flex flex-wrap items-center gap-x-1.5 text-ink-500">
            {FOOTER_LINKS.map((l, i) => (
              <span key={l.href} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden className="text-ink-300">
                    ·
                  </span>
                )}
                <Link href={l.href} className="hover:text-crimson-700">
                  {lang === "bn" ? l.bn : l.en}
                </Link>
              </span>
            ))}
          </nav>
          <h4 className="font-display font-bold text-ink-900 mb-2 text-xs uppercase tracking-wide">Language</h4>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                lang === "en" ? "bg-crimson-600 border-crimson-600 text-white" : "border-ink-200 text-ink-500"
              )}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("bn")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                lang === "bn" ? "bg-crimson-600 border-crimson-600 text-white" : "border-ink-200 text-ink-500"
              )}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 text-xs text-ink-400 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Jachai. Dhaka-first, verification-centric.</span>
          <span>Built for Bangladesh&apos;s local businesses.</span>
        </div>
      </div>
    </footer>
  );
}
