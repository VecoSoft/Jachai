"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Search, X } from "lucide-react";
import { businessApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { forgetSearch, readRecentSearches, rememberSearch } from "@/lib/recent-searches";
import type { SearchSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGEST_DEBOUNCE_MS = 180;
const MAX_QUERY_LENGTH = 100;

// Suggestions are a pure function of (lang, text), so keep every answer for the session — backspacing
// and retyping never re-fetches. Bounded so a long session can't grow it without limit.
const suggestionCache = new Map<string, SearchSuggestion[]>();
function cacheSuggestions(key: string, list: SearchSuggestion[]) {
  if (suggestionCache.size > 200) suggestionCache.clear();
  suggestionCache.set(key, list);
}

interface Row {
  key: string;
  label: string;
  icon: ReactNode;
  detail?: string | null;
  recent?: string;
  suggestion?: SearchSuggestion;
}

/** Bold the part of `label` the user already typed, so the completion stands out. */
function Highlighted({ label, typed }: { label: string; typed: string }) {
  const needle = typed.trim().toLowerCase();
  const at = needle ? label.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span className="font-semibold">{label.slice(at, at + needle.length)}</span>
      {label.slice(at + needle.length)}
    </>
  );
}

/**
 * The home page's one search box (navbar on desktop, hero strip on mobile/tablet — never both at
 * once). Typing only fetches lightweight, debounced suggestions; the actual search runs on Enter /
 * the submit button / picking a suggestion, via `onSubmit`. A picked business goes straight to its page.
 *
 * `formClassName` styles the visible box and `trailing` slots extra content before the submit button
 * (the navbar's city label), so each placement keeps its existing look.
 */
export function SmartSearchBar({
  value,
  onSubmit,
  className,
  formClassName,
  inputClassName,
  submitClassName,
  trailing,
  placeholder,
}: {
  value: string;
  onSubmit: (query: string) => void;
  className?: string;
  formClassName?: string;
  inputClassName?: string;
  submitClassName?: string;
  trailing?: ReactNode;
  placeholder?: string;
}) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  // Re-sync when the committed query changes elsewhere (category quick-nav, "clear search", the other breakpoint's box).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    setRecent(readRecentSearches());
  }, []);

  // Debounced suggestions for whatever is in the box (empty box → popular searches).
  useEffect(() => {
    if (!open) return;
    const text = draft.trim();
    const key = `${lang}|${text.toLowerCase()}`;
    const cached = suggestionCache.get(key);
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      businessApi
        .searchSuggestions(text, lang)
        .then((list) => {
          cacheSuggestions(key, list);
          if (seq === requestSeq.current) setSuggestions(list);
        })
        .catch(() => {
          // Suggestions are optional — the search itself still works on Enter.
          if (seq === requestSeq.current) setSuggestions([]);
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    }, text ? SUGGEST_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [draft, open, lang]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const typed = draft.trim();
  const rows: Row[] = [];
  if (!typed) {
    recent.forEach((r) => rows.push({ key: `recent:${r}`, label: r, icon: <Clock size={15} className="text-ink-400" />, recent: r }));
  }
  suggestions.forEach((s) =>
    rows.push({
      key: `${s.type}:${s.slug ?? s.query}`,
      label: s.label,
      icon: s.icon ?? <Search size={15} className="text-ink-400" />,
      detail: s.detail,
      suggestion: s,
    })
  );
  const firstSuggestionIndex = typed ? 0 : recent.length;
  const showList = open && (rows.length > 0 || loading);

  useEffect(() => {
    setActive(-1);
  }, [draft, suggestions.length, recent.length]);

  const submit = useCallback(
    (query: string) => {
      const q = query.trim().slice(0, MAX_QUERY_LENGTH);
      if (q) setRecent(rememberSearch(q));
      setDraft(q);
      setOpen(false);
      inputRef.current?.blur(); // hides the mobile keyboard so the results are visible
      onSubmit(q);
    },
    [onSubmit]
  );

  function pick(row: Row) {
    if (row.suggestion?.type === "BUSINESS" && row.suggestion.slug) {
      setOpen(false);
      router.push(`/business/${row.suggestion.slug}`);
      return;
    }
    submit(row.recent ?? row.suggestion?.query ?? row.label);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (rows.length) setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (draft) {
        setDraft("");
      }
    } else if (e.key === "Enter" && open && active >= 0 && rows[active]) {
      e.preventDefault();
      pick(rows[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function clear() {
    setDraft("");
    inputRef.current?.focus();
    setOpen(true);
    if (value) onSubmit("");
  }

  const activeId = active >= 0 ? `${listboxId}-opt-${active}` : undefined;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className={formClassName}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <Search aria-hidden className="ml-3 h-5 w-5 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label={t("search.label")}
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_QUERY_LENGTH}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? t("search.placeholder_short")}
            className={cn(
              "w-full min-w-0 bg-transparent px-3 py-3 text-base text-ink-800 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden",
              inputClassName
            )}
          />
          {draft && (
            <button
              type="button"
              onClick={clear}
              aria-label={t("search.clear")}
              className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson-500"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {trailing}
        <button
          type="submit"
          aria-label={t("search.submit")}
          className={cn(
            "grid w-14 shrink-0 place-items-center bg-crimson-500 text-white transition-colors hover:bg-crimson-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white",
            submitClassName
          )}
        >
          <Search className="h-5 w-5" />
        </button>
      </form>

      {showList && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop dark:border-ink-800 dark:bg-ink-900">
          <ul id={listboxId} role="listbox" aria-label={t("search.suggestions")} className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
            {rows.map((row, i) => (
              <li key={row.key} role="presentation">
                {i === 0 && row.recent && <SectionLabel>{t("search.recent")}</SectionLabel>}
                {i === firstSuggestionIndex && !typed && row.suggestion && <SectionLabel>{t("search.popular")}</SectionLabel>}
                <div
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()} // keep input focus so the click lands
                  onClick={() => pick(row)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-ink-700 dark:text-ink-200",
                    i === active && "bg-ink-50 dark:bg-ink-800"
                  )}
                >
                  <span aria-hidden className="grid w-5 shrink-0 place-items-center text-base leading-none">
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <Highlighted label={row.label} typed={typed} />
                    {row.detail && <span className="ml-1.5 text-xs text-ink-400">· {row.detail}</span>}
                  </span>
                  {row.recent && (
                    <button
                      type="button"
                      aria-label={t("search.remove_recent")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecent(forgetSearch(row.recent!));
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-ink-100 hover:text-ink-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
            {loading && rows.length === 0 && (
              <li role="presentation" className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink-400">
                <Loader2 size={15} className="animate-spin" /> {t("search.suggestions")}…
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{children}</p>;
}
