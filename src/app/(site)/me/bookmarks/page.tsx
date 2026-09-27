"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { bookmarkApi } from "@/lib/api";
import { RoleGate } from "@/components/role-gate";
import { errorMessage, useToast } from "@/lib/toast-context";
import { lookupBusiness, toBusinessCardData } from "@/lib/business-cache";
import type { Bookmark, Collection } from "@/lib/types";
import { BusinessCard } from "@/components/business-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, ErrorBanner, PageSpinner } from "@/components/ui/misc";

function BookmarkRow({ bookmark, onRemoved }: { bookmark: Bookmark; onRemoved: () => void }) {
  const { show } = useToast();
  const cached = lookupBusiness(bookmark.businessId);
  const cardData = cached ? toBusinessCardData(cached) : null;
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      await bookmarkApi.remove(bookmark.businessId);
      onRemoved();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setRemoving(false);
    }
  }

  // Bookmarks only ever carry a raw businessId (no "get business by id" endpoint exists) —
  // the rich card only renders once this business has been seen elsewhere in the app and
  // cached (see lib/business-cache.ts). Never seen before (or bookmarked on another
  // device/browser) falls back to this plain row instead of faking rating/price data.
  if (cardData) {
    return (
      <div className="relative border-b border-ink-100 py-3 last:border-0">
        <BusinessCard business={cardData} variant="list" />
        <Button
          variant="ghost"
          size="sm"
          onClick={remove}
          loading={removing}
          className="absolute right-2 top-2 bg-surface/90"
        >
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-3 last:border-0">
      <div>
        {cached ? (
          <Link href={`/business/${cached.slug}`} className="text-sm font-medium text-crimson-700 hover:underline">
            {cached.name}
          </Link>
        ) : (
          <span className="text-sm text-ink-500">Business {bookmark.businessId.slice(0, 8)}…</span>
        )}
        {cached && <p className="text-xs text-ink-400">{cached.categoryName} · {cached.areaName}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={remove} loading={removing}>
        Remove
      </Button>
    </div>
  );
}

function BookmarksContent() {
  const { show } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null); // null = default/all
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCollections = useCallback(() => {
    bookmarkApi.myCollections().then(setCollections).catch(() => {});
  }, []);

  const loadBookmarks = useCallback((collectionId: string | null) => {
    setLoading(true);
    setError(null);
    const promise =
      collectionId === null ? bookmarkApi.mine() : bookmarkApi.collectionBookmarks(collectionId);
    promise
      .then(setBookmarks)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCollections();
    loadBookmarks(null);
  }, [loadCollections, loadBookmarks]);

  async function createCollection() {
    if (!newCollectionName.trim()) return;
    setCreating(true);
    try {
      await bookmarkApi.createCollection(newCollectionName.trim());
      setNewCollectionName("");
      loadCollections();
      show("Collection created", "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteCollection(id: string) {
    if (!confirm("Delete this collection? Bookmarks inside it are not deleted, just ungrouped.")) return;
    try {
      await bookmarkApi.deleteCollection(id);
      if (activeCollection === id) {
        setActiveCollection(null);
        loadBookmarks(null);
      }
      loadCollections();
      show("Collection deleted", "success");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  function selectCollection(id: string | null) {
    setActiveCollection(id);
    loadBookmarks(id);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Collections</h2>
        <nav className="space-y-1">
          <button
            onClick={() => selectCollection(null)}
            className={`block w-full text-left px-3 py-2 rounded text-sm ${
              activeCollection === null ? "bg-crimson-50 text-crimson-800" : "hover:bg-ink-50 text-ink-700"
            }`}
          >
            All bookmarks
          </button>
          {collections.map((c) => (
            <div key={c.id} className="group flex items-center">
              <button
                onClick={() => selectCollection(c.id)}
                className={`flex-1 text-left px-3 py-2 rounded text-sm truncate ${
                  activeCollection === c.id ? "bg-crimson-50 text-crimson-800" : "hover:bg-ink-50 text-ink-700"
                }`}
              >
                {c.name || "Unnamed collection"}
              </button>
              <button
                onClick={() => deleteCollection(c.id)}
                className="opacity-0 group-hover:opacity-100 px-2 text-ink-300 hover:text-rose-600 text-xs"
                title="Delete collection"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>

        <div className="mt-4 flex gap-1.5">
          <Input
            placeholder="New collection"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCollection()}
          />
          <Button size="sm" onClick={createCollection} loading={creating}>
            Add
          </Button>
        </div>
      </div>

      <div className="md:col-span-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-4">
          {activeCollection ? collections.find((c) => c.id === activeCollection)?.name ?? "Collection" : "My bookmarks"}
        </h1>
        {loading && <PageSpinner />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && bookmarks.length === 0 && (
          <EmptyState
            title="No bookmarks here yet"
            description="Bookmark a business from its profile page to see it here."
          />
        )}
        {!loading && !error && bookmarks.length > 0 && (
          <div className="rounded-md border border-ink-100 bg-surface px-4 shadow-card">
            {bookmarks.map((b) => (
              <BookmarkRow key={b.id} bookmark={b} onRemoved={() => loadBookmarks(activeCollection)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <RoleGate>
      <BookmarksContent />
    </RoleGate>
  );
}
