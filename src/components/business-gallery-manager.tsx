"use client";

import { useEffect, useRef, useState } from "react";
import { galleryApi, photosApi, uploadFileToPresignedUrl } from "@/lib/api";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { BusinessPhoto } from "@/lib/types";
import { Button } from "./ui/button";
import { PageSpinner } from "./ui/misc";
import { PrivateImage } from "./private-image";

const MAX_PHOTOS = 10;

/**
 * Shared gallery management surface (spec Step 6) — used both inside the
 * business form (edit mode) and on the owner dashboard's Gallery tab. Handles
 * multi-file upload via the existing pre-signed URL flow, multi-select delete,
 * and reorder (◀/▶ buttons — deliberately no drag-and-drop dependency).
 *
 * New photos are moderated: the owner sees every photo here with its status — "Waiting for
 * review" (loaded with the owner's token, the public URL doesn't serve it yet) or "Rejected:
 * <reason>" (from GET /api/v1/photos/mine) with a Remove button.
 */
export function BusinessGalleryManager({
  businessId,
  onCountChange,
}: {
  businessId: string;
  onCountChange?: (count: number) => void;
}) {
  const { show } = useToast();
  const [photos, setPhotos] = useState<BusinessPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [pending, setPending] = useState<{ file: File; previewUrl: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Rejected gallery photo URL → the moderator's reason. */
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  function applyPhotos(next: BusinessPhoto[]) {
    setPhotos(next);
    onCountChange?.(next.length);
  }

  function load() {
    setLoading(true);
    Promise.all([galleryApi.list(businessId), photosApi.mine().catch(() => [])])
      .then(([list, mine]) => {
        applyPhotos(list);
        const reasons: Record<string, string> = {};
        for (const m of mine) {
          if (m.source === "BUSINESS_PHOTO" && m.status === "REJECTED" && m.reason) reasons[m.url] = m.reason;
        }
        setRejectReasons(reasons);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [businessId]);

  // Revoke not-yet-uploaded preview URLs if this unmounts, so we don't leak
  // blob: URLs for files the owner selected but never uploaded.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    if (photos.length + pending.length + incoming.length > MAX_PHOTOS) {
      show(`Maximum ${MAX_PHOTOS} gallery photos.`, "error");
      incoming.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPending((prev) => [...prev, ...incoming]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePending(index: number) {
    setPending((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function handleUpload() {
    if (pending.length === 0) return;
    if (photos.length + pending.length > MAX_PHOTOS) {
      show(`Maximum ${MAX_PHOTOS} gallery photos.`, "error");
      return;
    }
    setUploading(true);
    let heldForReview = 0;
    try {
      for (const p of pending) {
        const presigned = await galleryApi.requestUploadUrl(businessId, p.file.name);
        await uploadFileToPresignedUrl(presigned.uploadUrl, p.file);
        const saved = await galleryApi.confirm(businessId, presigned.cdnUrlAfterUpload);
        if (saved.moderationStatus === "PENDING") heldForReview++;
      }
      if (heldForReview > 0) {
        show(
          `${heldForReview} photo${heldForReview > 1 ? "s" : ""} uploaded — waiting for review before ${heldForReview > 1 ? "they appear" : "it appears"} on your page.`,
          "success"
        );
      }
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }

  function toggleSelected(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function deleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`Delete ${count} selected photo${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      for (const photoId of selectedIds) {
        await galleryApi.remove(businessId, photoId);
      }
      setSelectedIds(new Set());
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length || reordering) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = photos;
    applyPhotos(next); // optimistic
    setReordering(true);
    try {
      const saved = await galleryApi.reorder(businessId, next.map((p) => p.id));
      applyPhotos(saved);
    } catch (err) {
      applyPhotos(previous); // revert
      show(errorMessage(err), "error");
    } finally {
      setReordering(false);
    }
  }

  async function removeRejected(photoId: string) {
    setRemovingId(photoId);
    try {
      await galleryApi.remove(businessId, photoId);
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return <PageSpinner />;

  const liveCount = photos.filter((p) => (p.moderationStatus ?? "APPROVED") === "APPROVED").length;
  const waitingCount = photos.filter((p) => p.moderationStatus === "PENDING").length;
  const rejectedCount = photos.filter((p) => p.moderationStatus === "REJECTED").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="text-sm"
        />
        <Button size="sm" onClick={handleUpload} loading={uploading} disabled={pending.length === 0}>
          Upload{pending.length > 0 ? ` (${pending.length})` : ""}
        </Button>
        {selectedIds.size > 0 && (
          <Button size="sm" variant="danger" onClick={deleteSelected} loading={deleting}>
            Delete selected ({selectedIds.size})
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-400 mt-1">
        {liveCount}/{MAX_PHOTOS} live
        {waitingCount > 0 && ` · ${waitingCount} waiting`}
        {rejectedCount > 0 && ` · ${rejectedCount} rejected`}
        {photos.length > 1 && " · use ◀ ▶ to reorder — the first photo leads your gallery"}
      </p>

      {pending.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-500 mb-1">Ready to upload — click Upload to confirm</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {pending.map((p, i) => (
              <div
                key={p.previewUrl}
                className="relative aspect-square rounded overflow-hidden bg-ink-100 border-2 border-dashed border-ink-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  aria-label="Remove from upload queue"
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-scrim/70 text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
        {photos.map((p, i) => {
          const selected = selectedIds.has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "relative aspect-square rounded overflow-hidden bg-ink-100",
                selected && "ring-2 ring-crimson-600"
              )}
            >
              {p.moderationStatus === "REJECTED" ? (
                // Rejected: the file is no longer served — show why, and let the owner remove it.
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 pb-8 text-center">
                  <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white line-clamp-3">
                    Rejected{rejectReasons[p.url] ? `: ${rejectReasons[p.url]}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRejected(p.id)}
                    disabled={removingId === p.id}
                    className="rounded border border-ink-300 bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {removingId === p.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleSelected(p.id)}
                  aria-pressed={selected}
                  aria-label={selected ? "Deselect photo" : "Select photo"}
                  className="absolute inset-0"
                >
                  {p.moderationStatus === "PENDING" ? (
                    <PrivateImage src={p.url} className="h-full w-full object-cover opacity-80" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              )}
              {p.moderationStatus === "PENDING" && (
                <span className="pointer-events-none absolute top-1 right-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-amber-400/90 dark:text-ink-900">
                  Waiting for review
                </span>
              )}
              {p.moderationStatus !== "REJECTED" && (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1 left-1 h-5 w-5 rounded border flex items-center justify-center text-[11px] font-bold",
                    selected ? "bg-crimson-600 border-crimson-600 text-white" : "bg-white/85 border-ink-300 text-transparent"
                  )}
                >
                  ✓
                </span>
              )}
              {photos.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-scrim/55 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reordering}
                    aria-label="Move photo earlier"
                    className="h-5 w-5 rounded text-white text-xs leading-none disabled:opacity-30 hover:bg-white/20"
                  >
                    ◀
                  </button>
                  <span className="text-[10px] font-semibold text-white/90">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === photos.length - 1 || reordering}
                    aria-label="Move photo later"
                    className="h-5 w-5 rounded text-white text-xs leading-none disabled:opacity-30 hover:bg-white/20"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
