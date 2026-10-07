"use client";

import { useEffect, useState, type ReactNode } from "react";
import { contentApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorMessage } from "@/lib/toast-context";
import { formatDate } from "@/lib/utils";
import type { ContentPage, ContentSlug } from "@/lib/types";
import { CommunityMarkdown } from "@/components/community-markdown";
import { ErrorBanner, PageSpinner } from "@/components/ui/misc";

/**
 * Terms / Privacy / FAQ / Help — Markdown written in the admin panel (System → Content), in the
 * reader's language (falls back to English when the Bangla page isn't written yet).
 */
export function ContentPageView({ slug, children }: { slug: ContentSlug; children?: ReactNode }) {
  const { lang } = useLanguage();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    contentApi
      .get(slug, lang)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  if (error) return <ErrorBanner message={error} />;
  if (!page) return <PageSpinner />;

  return (
    <article className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-ink-900">{page.title}</h1>
      {page.updatedAt && (
        <p className="mt-1 text-xs text-ink-500">
          {lang === "bn" ? "সর্বশেষ হালনাগাদ" : "Last updated"}: {formatDate(page.updatedAt)}
        </p>
      )}
      <div className="mt-5 rounded-xl border border-ink-100 bg-surface p-5 text-sm text-ink-700">
        <CommunityMarkdown>{page.bodyMd}</CommunityMarkdown>
      </div>
      {children}
    </article>
  );
}
