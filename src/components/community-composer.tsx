"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Clock, ImagePlus, Plus, Store, X } from "lucide-react";
import { communityApi, uploadFileToPresignedUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import {
  COMMUNITY_COMPOSER_TYPES,
  COMMUNITY_POLL_DURATIONS,
  COMMUNITY_POLL_MAX_OPTIONS,
  COMMUNITY_POLL_MIN_OPTIONS,

} from "@/lib/community-constants";
import { errorMessage, useToast } from "@/lib/toast-context";
import { communityWriteBlock, postTypeEnabled, selectableTopics, useCommunitySettings, useCommunityStanding } from "@/lib/community-settings";
import { ApiClientError } from "@/lib/api";
import { avatarColorClass, avatarInitials, cn } from "@/lib/utils";
import type { CommunityMentionedBusinessSummary, CommunityPostResponse, CommunityPostType, CommunityTopic } from "@/lib/types";
import { CommunityMarkdownToolbar } from "./community-markdown-toolbar";
import { CommunityRestrictionNotice, CommunityRules } from "./community-moderation";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

// Fallbacks until GET /api/v1/community/settings loads — the admin-managed values replace them.
const DEFAULT_BODY_MAX = 5000;
const DEFAULT_POLL_DURATION_HOURS = 72;
const DEFAULT_MAX_PHOTO_MB = 5;
const DEFAULT_MAX_POST_PHOTOS = 10;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * "Join Community" V1 post composer — a single text box (no separate title
 * field or Discussion/Question/Recommendation picker; post type is DISCUSSION
 * under the hood, or POLL when the optional poll editor below the text box
 * is active), a topic, at most one optional attached business, and up to
 * MAX_POST_PHOTOS photo attachments (pre-signed direct-to-storage upload
 * per file, same flow as ReviewForm — see communityApi.requestUploadUrl).
 * Gated behind the Community-username setup flow, same as posting/commenting
 * on the backend (CommunityPostService#requireCommunityUsername). Opens as a
 * centered Modal (see below) rather than expanding inline in the page.
 */
export function CommunityComposer({ onPosted }: { onPosted: (post: CommunityPostResponse) => void }) {
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();
  const { openModal: openUsernameModal } = useCommunityUsernameModal();
  const { show } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<Exclude<CommunityPostType, "POLL">>("DISCUSSION");
  const [topic, setTopic] = useState<CommunityTopic>(() => "GENERAL");
  const [businessQuery, setBusinessQuery] = useState("");
  const [businessResults, setBusinessResults] = useState<CommunityMentionedBusinessSummary[]>([]);
  const [businessBoxOpen, setBusinessBoxOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<CommunityMentionedBusinessSummary | null>(null);
  const [pollActive, setPollActive] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDurationHours, setPollDurationHours] = useState(DEFAULT_POLL_DURATION_HOURS);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Admin-managed rules (server-enforced; mirrored here for UX).
  const settings = useCommunitySettings();
  const { standing, refresh: refreshStanding } = useCommunityStanding();
  const BODY_MAX = settings?.limits.postBodyMax ?? DEFAULT_BODY_MAX;
  const MAX_PHOTO_MB = settings?.maxImageSizeMb ?? DEFAULT_MAX_PHOTO_MB;
  const MAX_POST_PHOTOS = settings?.imagesEnabled === false ? 0 : (settings?.maxImagesPerPost ?? DEFAULT_MAX_POST_PHOTOS);
  const topics = selectableTopics(settings);
  const composerTypes = COMMUNITY_COMPOSER_TYPES.filter((t) => postTypeEnabled(settings, t.value));
  const pollsEnabled = postTypeEnabled(settings, "POLL");
  const writeBlock = communityWriteBlock(settings);
  const defaultTopic = settings?.defaultTopic ?? "GENERAL";

  // Keep the selections valid once the admin configuration arrives (or changes).
  useEffect(() => {
    if (!settings) return;
    if (!topics.some((t) => t.value === topic)) setTopic(defaultTopic);
    if (!composerTypes.some((t) => t.value === postType) && composerTypes.length > 0) setPostType(composerTypes[0].value);
    if (!pollsEnabled && pollActive) setPollActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (!businessQuery.trim()) {
      setBusinessResults([]);
      return;
    }
    const handle = setTimeout(() => {
      communityApi
        .searchMentions(businessQuery.trim())
        .then(setBusinessResults)
        .catch(() => setBusinessResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [businessQuery]);

  function reset() {
    setBody("");
    setPostType(composerTypes.some((t) => t.value === "DISCUSSION") ? "DISCUSSION" : (composerTypes[0]?.value ?? "DISCUSSION"));
    setTopic(defaultTopic);
    setSelectedBusiness(null);
    setBusinessQuery("");
    setBusinessBoxOpen(false);
    setPollActive(false);
    setPollOptions(["", ""]);
    setPollDurationHours(DEFAULT_POLL_DURATION_HOURS);
    setImageUrls([]);
    setExpanded(false);
  }

  async function handlePhotosSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Snapshot into a plain array before resetting the input below — `files`
    // is a live reference to the input's FileList, and resetting `.value`
    // (done so the same file can be re-picked later) empties that same
    // live object, which silently dropped every selection before this fix.
    const selectedFiles = Array.from(files);
    if (photoInputRef.current) photoInputRef.current.value = "";
    setUploadingPhoto(true);
    let count = imageUrls.length;
    try {
      for (const file of selectedFiles) {
        if (count >= MAX_POST_PHOTOS) {
          show(`You can attach at most ${MAX_POST_PHOTOS} photos`, "error");
          break;
        }
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
          show(`${file.name || "That file"} isn't an image (jpg, png, webp, gif)`, "error");
          continue;
        }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
          show(`${file.name || "That photo"} is too large (max ${MAX_PHOTO_MB}MB)`, "error");
          continue;
        }
        const presigned = await communityApi.requestUploadUrl(file.name || "post-photo.jpg");
        const ok = await uploadFileToPresignedUrl(presigned.uploadUrl, file);
        if (!ok) throw new Error("Upload failed");
        setImageUrls((prev) => [...prev, presigned.cdnUrlAfterUpload]);
        count++;
      }
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePollOption(index: number, value: string) {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addPollOption() {
    setPollOptions((prev) => (prev.length >= COMMUNITY_POLL_MAX_OPTIONS ? prev : [...prev, ""]));
  }

  function removePollOption(index: number) {
    setPollOptions((prev) => (prev.length <= COMMUNITY_POLL_MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index)));
  }

  function handleStart() {
    if (!user) {
      openLogin();
      return;
    }
    if (!profile?.communityUsername) {
      openUsernameModal(() => setExpanded(true));
      return;
    }
    // Opens as a modal (see the Modal-wrapped return below) rather than
    // expanding inline — Modal's own focus-trap effect already focuses the
    // body textarea once it's mounted and visible, so no manual focus() here.
    setExpanded(true);
  }

  async function handleSubmit() {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      show(pollActive ? "Write your poll question first" : "Write something first", "error");
      return;
    }
    const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (pollActive && trimmedOptions.length < COMMUNITY_POLL_MIN_OPTIONS) {
      show(`Add at least ${COMMUNITY_POLL_MIN_OPTIONS} poll options`, "error");
      return;
    }
    setSubmitting(true);
    try {
      const post = await communityApi.create({
        title: null,
        body: trimmedBody,
        postType: pollActive ? "POLL" : postType,
        topic,
        businessId: selectedBusiness?.id ?? null,
        areaId: null,
        pollOptions: pollActive ? trimmedOptions : null,
        pollDurationHours: pollActive ? pollDurationHours : null,
        imageUrls,
      });
      onPosted(post);
      reset();
      show(post.status === "PENDING" ? "Posted — it's waiting for review before others can see it" : "Posted", "success");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) refreshStanding();
      show(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-surface p-5 text-center shadow-card">
        <p className="text-sm text-ink-500">Log in to start a discussion.</p>
        <Button className="mt-3" size="sm" onClick={openLogin}>
          Log in
        </Button>
      </div>
    );
  }

  // Maintenance / read-only mode, or this member is muted/suspended/banned: no composer.
  if (writeBlock) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-surface p-4 text-center text-sm text-ink-500 shadow-card">{writeBlock}</div>
    );
  }
  if (standing?.restricted) {
    return <CommunityRestrictionNotice standing={standing} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleStart}
        className="group flex w-full items-center gap-3 rounded-2xl border border-ink-100 bg-surface px-4 py-3 text-left shadow-card transition-all duration-200 hover:border-crimson-200 hover:shadow-pop"
      >
        {profile?.communityUsername ? (
          profile.communityAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.communityAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                avatarColorClass(profile.communityUsername)
              )}
            >
              {avatarInitials(profile.communityUsername)}
            </span>
          )
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition-colors group-hover:bg-crimson-50 group-hover:text-crimson-500">
            <Plus size={18} />
          </span>
        )}
        <span className="text-sm text-ink-400">What's on your mind?</span>
      </button>

      {/* Opens as a centered modal (backdrop blur, floating card) instead of
          expanding the page's own layout — same shared Modal every other
          dialog in the app uses, not a bespoke inline-growing box. */}
      <Modal open={expanded} onClose={reset} labelledBy="community-composer-heading" panelClassName="max-w-xl">
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profile?.communityUsername &&
                (profile.communityAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.communityAvatarUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm",
                      avatarColorClass(profile.communityUsername)
                    )}
                  >
                    {avatarInitials(profile.communityUsername)}
                  </span>
                ))}
              <div className="leading-tight">
                <h2 id="community-composer-heading" className="font-display text-lg font-bold text-ink-900">
                  Create a Post
                </h2>
                {profile?.communityUsername && <p className="text-xs text-ink-400">Posting as u/{profile.communityUsername}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-full p-1.5 text-ink-400 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Cancel post"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-full bg-ink-50 p-1">
            {composerTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={pollActive}
                onClick={() => setPostType(t.value)}
                className={cn(
                  "flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150",
                  pollActive
                    ? "cursor-not-allowed text-ink-300"
                    : postType === t.value
                      ? "bg-ink-900 text-white"
                      : "text-ink-500 hover:text-ink-800"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-ink-200 bg-ink-50 transition-colors duration-150 focus-within:border-crimson-300 focus-within:ring-2 focus-within:ring-crimson-500/20">
            <CommunityMarkdownToolbar textareaRef={bodyRef} onChange={(next) => setBody(next.slice(0, BODY_MAX))} />
            <div className="h-px bg-ink-200" />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              placeholder={
                pollActive
                  ? "Ask a question for people to vote on…"
                  : postType === "QUESTION"
                    ? "What do you want to ask?"
                    : postType === "RECOMMENDATION"
                      ? "Share your experience…"
                      : "What's on your mind?"
              }
              rows={5}
              className="w-full resize-none border-0 bg-transparent px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0"
            />
            <div className="flex justify-end px-3 pb-1.5">
              <span className={cn("text-[11px] tabular-nums", body.length > BODY_MAX * 0.9 ? "text-crimson-600 font-medium" : "text-ink-300")}>
                {body.length}/{BODY_MAX}
              </span>
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handlePhotosSelected(e.target.files)}
            className="hidden"
          />

          {imageUrls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors duration-150 hover:bg-black/80"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pollActive && (
            <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div className="flex flex-col gap-1.5">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-500">
                      {index + 1}
                    </span>
                    <input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value.slice(0, 80))}
                      placeholder={`Option ${index + 1}`}
                      className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-sm placeholder:text-ink-300 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-crimson-500/30 focus:border-crimson-500"
                    />
                    {pollOptions.length > COMMUNITY_POLL_MIN_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => removePollOption(index)}
                        aria-label={`Remove option ${index + 1}`}
                        className="shrink-0 rounded-full p-1.5 text-ink-400 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-700"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {pollOptions.length < COMMUNITY_POLL_MAX_OPTIONS ? (
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-2.5 py-1.5 text-xs font-medium text-ink-500 transition-colors duration-150 hover:border-crimson-300 hover:text-crimson-700"
                  >
                    <Plus size={13} /> Add option
                  </button>
                ) : (
                  <span />
                )}
                <div className="relative">
                  <Clock size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <select
                    value={pollDurationHours}
                    onChange={(e) => setPollDurationHours(Number(e.target.value))}
                    className="appearance-none rounded-lg border border-ink-200 bg-surface py-1 pl-7 pr-2.5 text-xs font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-crimson-500/30"
                  >
                    {COMMUNITY_POLL_DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as CommunityTopic)}
              className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-150 hover:border-ink-300 focus:outline-none focus:ring-2 focus:ring-crimson-500/30"
            >
              {topics.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {imageUrls.length < MAX_POST_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800 disabled:opacity-50"
              >
                <ImagePlus size={13} className="shrink-0" />
                {uploadingPhoto ? "Uploading…" : imageUrls.length > 0 ? "Add more photos" : "Add photos"}
              </button>
            )}

            {!pollsEnabled ? null : pollActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson-50 px-2.5 py-1 text-xs font-medium text-crimson-700">
                <BarChart3 size={13} className="shrink-0" /> Poll
                <button type="button" onClick={() => setPollActive(false)} aria-label="Remove poll" className="text-crimson-500 transition-colors duration-150 hover:text-crimson-700">
                  <X size={13} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPollActive(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800"
              >
                <BarChart3 size={13} className="shrink-0" /> Add poll
              </button>
            )}

            {selectedBusiness ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson-50 px-2.5 py-1 text-xs font-medium text-crimson-700">
                <Store size={13} className="shrink-0" /> {selectedBusiness.name}
                <button type="button" onClick={() => setSelectedBusiness(null)} aria-label="Remove business" className="text-crimson-500 transition-colors duration-150 hover:text-crimson-700">
                  <X size={13} />
                </button>
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBusinessBoxOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800"
                >
                  <Store size={13} className="shrink-0" /> Attach a business
                </button>
                {businessBoxOpen && (
                  <div className="absolute left-0 z-20 mt-1.5 w-64 animate-scale-in">
                    <input
                      autoFocus
                      value={businessQuery}
                      onChange={(e) => setBusinessQuery(e.target.value)}
                      placeholder="Search businesses…"
                      className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm shadow-pop placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-crimson-500/30 focus:border-crimson-500"
                    />
                    {businessResults.length > 0 && (
                      <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-ink-100 bg-surface shadow-pop">
                        {businessResults.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBusiness(b);
                              setBusinessBoxOpen(false);
                              setBusinessQuery("");
                              setBusinessResults([]);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-ink-50"
                          >
                            {b.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400">
                                <Store size={11} />
                              </span>
                            )}
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <CommunityRules variant="composer" />

          <div className="mt-4 flex justify-end border-t border-ink-100 pt-3">
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={submitting}
              disabled={
                !body.trim() ||
                uploadingPhoto ||
                (pollActive && pollOptions.map((o) => o.trim()).filter(Boolean).length < COMMUNITY_POLL_MIN_OPTIONS)
              }
            >
              Post
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
