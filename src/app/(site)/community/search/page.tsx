"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { communityApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorMessage } from "@/lib/toast-context";
import type { CommunityFollowListItem, CommunityPostResponse } from "@/lib/types";
import { cn, focusRing } from "@/lib/utils";
import { CommunityFollowList } from "@/components/community-follow-list";
import { CommunityPostCard } from "@/components/community-post-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";

type Tab = "all" | "posts" | "people";
const TABS: Tab[] = ["all", "posts", "people"];
const MIN_LENGTH = 2;
const POSTS_PAGE = 10;
const PEOPLE_PAGE = 20;
const PEOPLE_PREVIEW = 3;

interface Results<T> {
  items: T[];
  total: number;
  page: number;
}

const empty = <T,>(): Results<T> => ({ items: [], total: 0, page: 0 });

export default function CommunitySearchPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CommunitySearch />
    </Suspense>
  );
}

/**
 * Community search (V60): posts (every word must appear, Bangla or English) and people (by
 * community username only). The query and tab live in the URL so a search can be shared and
 * survives back/forward.
 */
function CommunitySearch() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const urlTab = (TABS as string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "all";

  const [input, setInput] = useState(urlQuery);
  const [posts, setPosts] = useState<Results<CommunityPostResponse>>(empty);
  const [people, setPeople] = useState<Results<CommunityFollowListItem>>(empty);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = urlQuery.trim();
  const searchable = query.length >= MIN_LENGTH;

  const setUrl = useCallback(
    (q: string, tab: Tab) => {
      const next = new URLSearchParams();
      if (q.trim()) next.set("q", q.trim());
      if (tab !== "all") next.set("tab", tab);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Typing updates the URL after a short pause; the URL drives the actual search.
  useEffect(() => {
    if (input.trim() === query) return;
    const handle = setTimeout(() => setUrl(input, urlTab), 300);
    return () => clearTimeout(handle);
  }, [input, query, urlTab, setUrl]);

  // Keep the box in sync when the URL changes from outside (back/forward, a shared link).
  useEffect(() => {
    setInput((prev) => (prev.trim() === urlQuery.trim() ? prev : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    setError(null);
    if (!searchable) {
      setPosts(empty);
      setPeople(empty);
      setLoading(false);
      return;
    }
    setLoading(true);
    const wantPosts = urlTab !== "people";
    const wantPeople = urlTab !== "posts";
    Promise.all([
      wantPosts ? communityApi.searchPosts(query, 0, POSTS_PAGE) : Promise.resolve(null),
      wantPeople ? communityApi.searchPeople(query, 0, urlTab === "all" ? PEOPLE_PREVIEW : PEOPLE_PAGE) : Promise.resolve(null),
    ])
      .then(([postRes, peopleRes]) => {
        if (id !== requestId.current) return;
        setPosts(postRes ? { items: postRes.content, total: postRes.totalElements, page: 0 } : empty());
        setPeople(peopleRes ? { items: peopleRes.content, total: peopleRes.totalElements, page: 0 } : empty());
      })
      .catch((err) => id === requestId.current && setError(errorMessage(err)))
      .finally(() => id === requestId.current && setLoading(false));
  }, [query, urlTab, searchable]);

  async function loadMore(kind: "posts" | "people") {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (kind === "posts") {
        const res = await communityApi.searchPosts(query, posts.page + 1, POSTS_PAGE);
        setPosts((prev) => ({ items: [...prev.items, ...res.content], total: res.totalElements, page: prev.page + 1 }));
      } else {
        const res = await communityApi.searchPeople(query, people.page + 1, PEOPLE_PAGE);
        setPeople((prev) => ({ items: [...prev.items, ...res.content], total: res.totalElements, page: prev.page + 1 }));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function handleToggled(userId: string, isFollowing: boolean) {
    setPeople((prev) => ({ ...prev, items: prev.items.map((i) => (i.author.id === userId ? { ...i, isFollowing } : i)) }));
  }

  function handlePostChanged(updated: CommunityPostResponse) {
    setPosts((prev) => ({ ...prev, items: prev.items.map((p) => (p.id === updated.id ? updated : p)) }));
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1), items: prev.items.filter((p) => p.id !== postId) }));
  }

  const showPeople = urlTab !== "posts";
  const showPosts = urlTab !== "people";
  const nothing = searchable && !loading && !error && posts.total === 0 && people.total === 0;

  const tabLabel: Record<Tab, string> = {
    all: t("community.search.tab_all"),
    posts: t("community.search.tab_posts"),
    people: t("community.search.tab_people"),
  };

  return (
    <div className="py-6">
      <h1 className="font-display text-2xl font-bold text-ink-900">{t("community.search.title")}</h1>

      <form
        role="search"
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setUrl(input, urlTab);
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-surface px-4 focus-within:border-crimson-500 focus-within:ring-2 focus-within:ring-crimson-500/30">
          <Search size={18} className="shrink-0 text-ink-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("community.search.placeholder")}
            aria-label={t("community.search.placeholder")}
            maxLength={100}
            enterKeyHint="search"
            className="min-h-12 w-full bg-transparent text-base text-ink-900 placeholder:text-ink-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {input && (
            <button
              type="button"
              aria-label={t("community.search.clear")}
              onClick={() => {
                setInput("");
                setUrl("", urlTab);
                inputRef.current?.focus();
              }}
              className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100", focusRing)}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      <div role="tablist" aria-label={t("community.search.title")} className="mt-4 flex gap-1 border-b border-ink-100">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={urlTab === tab}
            onClick={() => setUrl(input, tab)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors",
              focusRing,
              urlTab === tab ? "border-crimson-600 text-crimson-700" : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            {tabLabel[tab]}
            {searchable && !loading && tab !== "all" && (
              <span className="ml-1.5 text-xs font-medium tabular-nums text-ink-400">
                {tab === "posts" ? (urlTab === "people" ? "" : posts.total) : urlTab === "posts" ? "" : people.total}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5" role="tabpanel" aria-live="polite">
        {!query && <p className="text-sm text-ink-500">{t("community.search.intro")}</p>}
        {query && !searchable && <p className="text-sm text-ink-500">{t("community.search.too_short")}</p>}
        {error && <ErrorBanner message={error} />}
        {loading && <PageSpinner />}

        {nothing && (
          <EmptyState
            title={
              urlTab === "posts"
                ? t("community.search.no_posts", { q: query })
                : urlTab === "people"
                  ? t("community.search.no_people", { q: query })
                  : t("community.search.no_results", { q: query })
            }
            description={urlTab === "people" ? t("community.search.people_hint") : undefined}
          />
        )}

        {searchable && !loading && !nothing && (
          <div className="space-y-8">
            {showPeople && people.items.length > 0 && (
              <section aria-labelledby="search-people-heading">
                {urlTab === "all" && (
                  <h2 id="search-people-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
                    {t("community.search.people")}
                  </h2>
                )}
                <CommunityFollowList items={people.items} onToggled={handleToggled} />
                {urlTab === "all" && people.total > people.items.length && (
                  <Button variant="ghost" size="sm" className="mt-2 min-h-11" onClick={() => setUrl(input, "people")}>
                    {t("community.search.see_all_people")} ({people.total})
                  </Button>
                )}
                {urlTab === "people" && people.items.length < people.total && (
                  <Button variant="outline" className="mt-4 w-full" loading={loadingMore} onClick={() => loadMore("people")}>
                    {t("community.search.load_more")}
                  </Button>
                )}
              </section>
            )}

            {showPosts && posts.items.length > 0 && (
              <section aria-labelledby="search-posts-heading">
                {urlTab === "all" && (
                  <h2 id="search-posts-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
                    {t("community.search.posts")}
                  </h2>
                )}
                <div className="space-y-4">
                  {posts.items.map((post) => (
                    <CommunityPostCard key={post.id} post={post} onChanged={handlePostChanged} onDeleted={handlePostDeleted} />
                  ))}
                </div>
                {posts.items.length < posts.total && (
                  <Button variant="outline" className="mt-4 w-full" loading={loadingMore} onClick={() => loadMore("posts")}>
                    {t("community.search.load_more")}
                  </Button>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
