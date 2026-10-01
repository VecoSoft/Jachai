"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Download, ImageOff, ImagePlus, Megaphone, Sparkles, Store, Tag, Upload, UtensilsCrossed } from "lucide-react";
import { promoApi } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { downloadImage, renderAndUpload, toJpeg } from "@/lib/promo-publish";
import { errorMessage, useToast } from "@/lib/toast-context";
import { cn, focusRing } from "@/lib/utils";
import type {
  BusinessPostType,
  CaptionResult,
  CommunityPostResponse,
  CreativeData,
  CreativeView,
  PromoImageFit,
  PromoRenderModel,
  PromoTemplateKey,
  StudioData,
} from "@/lib/types";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { Input, Label, Textarea } from "../ui/field";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { ErrorBanner } from "../ui/misc";
import { CreativePreview } from "./creative-preview";
import { ShareBar } from "./share-bar";

const HEADLINE_MAX = 40;
const SUBLINE_MAX = 80;

type Kind = "OFFER" | "MENU_ITEM" | "EVENT" | "GENERAL";

const DEFAULT_TEMPLATE: Record<Kind, PromoTemplateKey> = {
  OFFER: "OFFER_BOLD",
  MENU_ITEM: "MENU_HIGHLIGHT",
  EVENT: "EVENT_POSTER",
  GENERAL: "RATING_SHOWCASE",
};

function clip(s: string | null | undefined, max: number) {
  if (!s) return "";
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join("") : s;
}

/** "2026-09-30T18:00" (datetime-local, Dhaka wall clock) → ISO instant. */
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Auto Design Studio (V58): a good-looking promo in under a minute, from the business's own data.
 * Not a free-form editor — owners choose what to promote, pick a template that's already filled in,
 * and make light edits (headline, subline, accent colour, photo from their own listing, toggles).
 * Prices, offer terms and ratings are never editable: the server supplies them.
 *
 * V61: owners aren't tied to our designs — "Your own design" takes a banner they made elsewhere
 * (uploaded from their device) and turns it into every format, and any template can use an
 * uploaded photo too.
 */
export function DesignStudio({
  businessId,
  initialKind,
  initialOfferId,
  onPosted,
}: {
  businessId: string;
  initialKind?: Kind;
  initialOfferId?: string | null;
  onPosted?: (post: CommunityPostResponse) => void;
}) {
  const { t, lang } = useLanguage();
  const { show } = useToast();
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [kind, setKind] = useState<Kind | null>(initialKind ?? (initialOfferId ? "OFFER" : null));
  const [offerId, setOfferId] = useState<string | null>(initialOfferId ?? null);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [templatePicked, setTemplatePicked] = useState(false);
  const [templateKey, setTemplateKey] = useState<PromoTemplateKey>(DEFAULT_TEMPLATE[initialKind ?? (initialOfferId ? "OFFER" : "GENERAL")]);
  const [headline, setHeadline] = useState("");
  const [subline, setSubline] = useState("");
  const [accent, setAccent] = useState<string>("#C8102E");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imageFit, setImageFit] = useState<PromoImageFit>("FIT");
  const [uploads, setUploads] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [showRating, setShowRating] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");

  const [baseModel, setBaseModel] = useState<PromoRenderModel | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState<"friendly" | "premium" | "urgent">("friendly");
  const [captions, setCaptions] = useState<CaptionResult | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [busy, setBusy] = useState<null | "post" | "draft" | "download">(null);
  const [creative, setCreative] = useState<CreativeView | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [posted, setPosted] = useState<CommunityPostResponse | null>(null);

  useEffect(() => {
    promoApi
      .studio(businessId)
      .then((s) => {
        setStudio(s);
        setUploads(s.uploads ?? []);
        if (s.logoColor) setAccent(s.logoColor);
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [businessId]);

  const selectedOffer = studio?.offers.find((o) => o.id === offerId) ?? null;
  const selectedItem = studio?.menuItems.find((m) => m.id === menuItemId) ?? null;

  // Sensible defaults the moment the owner picks something — they can still edit.
  useEffect(() => {
    if (!kind) return;
    // Only one choice? Pick it so the preview appears straight away.
    if (kind === "OFFER" && !offerId && studio?.offers.length === 1) return setOfferId(studio.offers[0].id);
    if (kind === "MENU_ITEM" && !menuItemId && studio?.menuItems.length === 1) return setMenuItemId(studio.menuItems[0].id);
    // Keep a template the owner picked by hand if it fits; otherwise use this kind's default.
    setTemplateKey((prev) =>
      templatePicked && studio?.templates.find((tpl) => tpl.key === prev && tpl.supportedTypes.includes(kind)) ? prev : DEFAULT_TEMPLATE[kind]
    );
    if (kind === "OFFER" && selectedOffer) setHeadline(clip(selectedOffer.title, HEADLINE_MAX));
    if (kind === "MENU_ITEM" && selectedItem) setHeadline(clip(selectedItem.name, HEADLINE_MAX));
    if (kind === "GENERAL" && studio && !headline) setHeadline(clip(studio.businessName, HEADLINE_MAX));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, offerId, menuItemId, studio]);

  const data: CreativeData = useMemo(
    () => ({
      headline: headline.trim() || null,
      subline: subline.trim() || null,
      accentColor: accent,
      photoUrl,
      offerId: kind === "OFFER" ? offerId : null,
      menuItemId: kind === "MENU_ITEM" ? menuItemId : kind === "OFFER" ? null : null,
      eventTitle: kind === "EVENT" ? eventTitle.trim() || null : null,
      eventStart: kind === "EVENT" ? localToIso(eventStart) : null,
      eventEnd: kind === "EVENT" ? localToIso(eventEnd) : null,
      showRating,
      showQr,
      showPrice,
      imageFit,
    }),
    [headline, subline, accent, photoUrl, kind, offerId, menuItemId, eventTitle, eventStart, eventEnd, showRating, showQr, showPrice, imageFit]
  );

  // Facts come from the server; refetch only when the facts-bearing choices change (not on every keystroke).
  const factsKey = `${kind}|${offerId}|${menuItemId}|${photoUrl}|${data.eventStart}|${data.eventEnd}`;
  const factsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kind || !studio) return;
    if (kind === "OFFER" && !offerId) return;
    if (kind === "MENU_ITEM" && !menuItemId) return;
    if (factsRef.current === factsKey && baseModel) return;
    factsRef.current = factsKey;
    setModelLoading(true);
    promoApi
      .previewModel(businessId, { templateKey, data })
      .then(setBaseModel)
      .catch((err) => show(errorMessage(err), "error"))
      .finally(() => setModelLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsKey, studio]);

  /** Owner's cosmetic edits applied instantly on top of the server's facts. */
  const modelFor = useCallback(
    (key: PromoTemplateKey): PromoRenderModel | null =>
      baseModel && {
        ...baseModel,
        templateKey: key,
        headline: data.headline,
        subline: data.subline,
        accentColor: accent,
        showRating: showRating && baseModel.averageRating != null,
        showQr,
        showPrice,
        imageFit,
        event: kind === "EVENT" && data.eventStart ? { title: data.eventTitle, start: data.eventStart, end: data.eventEnd, location: baseModel.event?.location ?? null } : baseModel.event,
      },
    [baseModel, data, accent, showRating, showQr, showPrice, kind, imageFit]
  );

  const templates = (studio?.templates ?? []).filter(
    (tpl) => (!kind || tpl.supportedTypes.includes(kind)) && (tpl.key !== "CUSTOM" || studio?.uploadsEnabled)
  );
  const custom = templateKey === "CUSTOM";

  function pickTemplate(key: PromoTemplateKey) {
    setTemplateKey(key);
    setTemplatePicked(true);
  }

  /** V61: the owner's own image → JPEG in the browser → pre-signed upload → used right away. */
  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      show(t("promo.studio.upload_not_image"), "error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      show(t("promo.studio.upload_too_big"), "error");
      return;
    }
    setUploading(true);
    try {
      const { blob, width, height } = await toJpeg(file);
      const slot = await promoApi.uploadSlot(businessId);
      const res = await fetch(slot.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error(t("promo.studio.upload_failed"));
      setUploads((prev) => [slot.url, ...prev.filter((u) => u !== slot.url)]);
      setPhotoUrl(slot.url);
      if (Math.min(width, height) < 600) show(t("promo.studio.upload_small"), "info");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }
  const model = modelFor(templateKey);
  const signature = JSON.stringify({ templateKey, data });

  async function ensureCreative(): Promise<CreativeView> {
    if (creative && savedFor === signature && creative.squareUrl) return creative;
    const body = { templateKey, data };
    const saved = creative ? await promoApi.updateCreative(creative.id, body) : await promoApi.saveCreative(businessId, body);
    const rendered = await renderAndUpload(saved);
    setCreative(rendered);
    setSavedFor(signature);
    return rendered;
  }

  async function writeForMe() {
    if (!kind) return;
    setCaptionBusy(true);
    try {
      const res = await promoApi.captions(businessId, {
        type: kind,
        offerId: kind === "OFFER" ? offerId : null,
        menuItemId: kind === "MENU_ITEM" ? menuItemId : null,
        eventTitle: kind === "EVENT" ? eventTitle || null : null,
        eventStart: kind === "EVENT" ? localToIso(eventStart) : null,
        tone,
      });
      setCaptions(res);
      if (!caption.trim()) setCaption((lang === "bn" ? res.bn : res.en)[0] ?? "");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setCaptionBusy(false);
    }
  }

  async function submit(publish: boolean) {
    if (!kind) return;
    if (caption.trim().length < 20) {
      show(t("promo.studio.caption_too_short"), "error");
      return;
    }
    setBusy(publish ? "post" : "draft");
    try {
      const c = await ensureCreative();
      const postType: BusinessPostType = kind;
      const post = await promoApi.createPost(businessId, {
        type: postType,
        title: null,
        body: caption.trim(),
        creativeId: c.id,
        offerId: kind === "OFFER" ? offerId : null,
        menuItemId: kind === "MENU_ITEM" ? menuItemId : null,
        eventStart: kind === "EVENT" ? localToIso(eventStart) : null,
        eventEnd: kind === "EVENT" ? localToIso(eventEnd) : null,
        publish,
      });
      setPosted(post);
      onPosted?.(post);
      show(
        !publish ? t("promo.studio.saved_draft") : post.status === "PENDING" ? t("promo.studio.waiting_review") : t("promo.studio.posted"),
        "success"
      );
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function download(format: "SQUARE" | "STORY") {
    setBusy("download");
    try {
      const c = await ensureCreative();
      const url = format === "SQUARE" ? c.squareUrl : c.storyUrl;
      if (url) await downloadImage(url, `${studio?.slug ?? "promo"}-${format.toLowerCase()}.png`);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <ErrorBanner message={loadError} />;
  if (!studio) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (posted) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
          <Check />
        </div>
        <h2 className="font-display text-xl font-bold text-ink-900">
          {posted.status === "DRAFT" ? t("promo.studio.saved_draft") : posted.status === "PENDING" ? t("promo.studio.waiting_review") : t("promo.studio.posted")}
        </h2>
        {creative?.squareUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.squareUrl} alt="" className="mx-auto w-64 rounded-xl border border-ink-100 shadow-card" />
        )}
        {posted.status === "ACTIVE" && <ShareBar postId={posted.id} text={caption} className="justify-center" />}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/community/${posted.id}`} className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-crimson-700 hover:bg-crimson-50", focusRing)}>
            {t("promo.studio.view_post")}
          </Link>
          <Button variant="outline" onClick={() => { setPosted(null); setCaption(""); setCaptions(null); }}>
            {t("promo.studio.make_another")}
          </Button>
        </div>
      </div>
    );
  }

  const kinds: { value: Kind; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { value: "OFFER", label: t("promo.studio.kind_offer"), icon: <Tag size={16} />, disabled: studio.offers.length === 0 },
    { value: "MENU_ITEM", label: t("promo.studio.kind_menu"), icon: <UtensilsCrossed size={16} />, disabled: studio.menuItems.length === 0 },
    { value: "EVENT", label: t("promo.studio.kind_event"), icon: <CalendarDays size={16} /> },
    { value: "GENERAL", label: t("promo.studio.kind_business"), icon: <Store size={16} /> },
  ];

  const outOfPosts = studio.postsRemainingThisWeek <= 0;
  const ready =
    Boolean(model) && (kind !== "OFFER" || offerId) && (kind !== "MENU_ITEM" || menuItemId) && (kind !== "EVENT" || eventStart) && (!custom || Boolean(photoUrl));
  const swatches = Array.from(new Set([...(studio.logoColor ? [studio.logoColor] : []), ...studio.swatches]));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-28 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:pb-0">
      {/* Preview (left on desktop, top on mobile) */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        {model ? (
          <div className={cn("transition-opacity", modelLoading && "opacity-60")}>
            <PreviewSized model={model} />
          </div>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
            <Megaphone className="text-ink-300" />
            {kind ? t("promo.studio.pick_to_preview") : t("promo.studio.start_hint")}
          </div>
        )}
        {model && (
          <p className="mt-2 text-xs text-ink-500">
            {t("promo.studio.facts_note")}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadImage(file);
          }}
        />
        {outOfPosts && (
          <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t("promo.studio.limit_reached")}
          </p>
        )}
        <section>
          <h2 className="text-sm font-semibold text-ink-900">{t("promo.studio.what")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {kinds.map((k) => (
              <Chip key={k.value} size="md" active={kind === k.value} disabled={k.disabled} onClick={() => setKind(k.value)}>
                {k.icon} {k.label}
              </Chip>
            ))}
          </div>
          {kind === "OFFER" && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {studio.offers.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOfferId(o.id)}
                  className={cn(
                    "min-h-11 rounded-xl border p-3 text-left text-sm",
                    focusRing,
                    offerId === o.id ? "border-crimson-500 bg-crimson-50 dark:bg-crimson-900/30" : "border-ink-200 hover:border-ink-300"
                  )}
                >
                  <span className="block font-semibold text-ink-900">{o.title}</span>
                  <span className="text-xs text-ink-500">
                    {t("promo.studio.valid_until", { date: new Date(o.validUntil).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB") })}
                  </span>
                </button>
              ))}
            </div>
          )}
          {kind === "MENU_ITEM" && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {studio.menuItems.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMenuItemId(m.id)}
                  className={cn(
                    "overflow-hidden rounded-xl border text-left text-sm",
                    focusRing,
                    menuItemId === m.id ? "border-crimson-500 ring-2 ring-crimson-500/30" : "border-ink-200 hover:border-ink-300"
                  )}
                >
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center bg-ink-50 text-ink-300">
                      <UtensilsCrossed size={20} />
                    </span>
                  )}
                  <span className="block truncate px-2 pt-1.5 font-medium text-ink-900">{m.name}</span>
                  <span className="block px-2 pb-2 text-xs text-ink-500">{m.price != null ? `৳${m.price}` : m.priceText ?? ""}</span>
                </button>
              ))}
            </div>
          )}
          {kind === "EVENT" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="ev-title">{t("promo.studio.event_title")}</Label>
                <Input id="ev-title" value={eventTitle} maxLength={80} onChange={(e) => setEventTitle(e.target.value)} className="text-base" />
              </div>
              <div>
                <Label htmlFor="ev-start">{t("promo.studio.event_start")}</Label>
                <Input id="ev-start" type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="text-base" />
              </div>
              <div>
                <Label htmlFor="ev-end">{t("promo.studio.event_end")}</Label>
                <Input id="ev-end" type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className="text-base" />
              </div>
            </div>
          )}
        </section>

        {kind && baseModel && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-900">{t("promo.studio.template")}</h2>
              {studio.uploadsEnabled && !custom && (
                <button
                  type="button"
                  onClick={() => pickTemplate("CUSTOM")}
                  className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-crimson-700 hover:bg-crimson-50", focusRing)}
                >
                  <ImagePlus size={16} /> {t("promo.studio.have_own")}
                </button>
              )}
            </div>
            <div className="-mx-1 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label={t("promo.studio.template")}>
              {templates.map((tpl) => {
                const m = modelFor(tpl.key);
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    role="radio"
                    aria-checked={templateKey === tpl.key}
                    onClick={() => pickTemplate(tpl.key)}
                    className={cn("snap-start rounded-xl p-1", focusRing, templateKey === tpl.key ? "ring-2 ring-crimson-500" : "ring-1 ring-ink-100")}
                  >
                    {m && <CreativePreview model={m} width={132} />}
                    <span className="mt-1 block text-center text-xs font-medium text-ink-700">{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {kind && baseModel && custom && (
          <section className="space-y-4" aria-labelledby="own-design-heading">
            <h2 id="own-design-heading" className="text-sm font-semibold text-ink-900">{t("promo.studio.your_design")}</h2>
            <p className="text-sm text-ink-600">{t("promo.studio.custom_hint")}</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className={cn(
                "flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-200 px-4 py-5 text-sm font-semibold text-ink-700 hover:border-crimson-400 hover:bg-crimson-50/40 disabled:opacity-60",
                focusRing
              )}
            >
              <Upload size={22} className="text-crimson-600" />
              {uploading ? t("promo.studio.uploading") : photoUrl ? t("promo.studio.upload_another") : t("promo.studio.upload")}
              <span className="text-xs font-normal text-ink-500">{t("promo.studio.upload_formats")}</span>
            </button>
            {uploads.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink-700">{t("promo.studio.your_uploads")}</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {uploads.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPhotoUrl(p)}
                      aria-pressed={photoUrl === p}
                      className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-lg border", focusRing, photoUrl === p ? "border-crimson-500 ring-2 ring-crimson-500/30" : "border-ink-200")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {photoUrl && (
              <div>
                <p className="text-sm font-medium text-ink-700">{t("promo.studio.placement")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip size="md" active={imageFit === "FIT"} onClick={() => setImageFit("FIT")}>
                    {t("promo.studio.fit")}
                  </Chip>
                  <Chip size="md" active={imageFit === "FILL"} onClick={() => setImageFit("FILL")}>
                    {t("promo.studio.fill")}
                  </Chip>
                </div>
                <p className="mt-1.5 text-xs text-ink-500">{imageFit === "FIT" ? t("promo.studio.fit_hint") : t("promo.studio.fill_hint")}</p>
              </div>
            )}
            {photoUrl && imageFit === "FIT" && (
              <div>
                <p className="text-sm font-medium text-ink-700">{t("promo.studio.backdrop")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {swatches.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={accent === c}
                      onClick={() => setAccent(c)}
                      className={cn("h-11 w-11 rounded-full border-2", focusRing, accent === c ? "border-ink-900 dark:border-white" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            )}
            <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600">{t("promo.studio.upload_rules")}</p>
          </section>
        )}

        {kind && baseModel && !custom && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink-900">{t("promo.studio.edit")}</h2>
            <div>
              <Label htmlFor="headline">
                {t("promo.studio.headline")} <span className="text-ink-400">({Array.from(headline).length}/{HEADLINE_MAX})</span>
              </Label>
              <Input id="headline" value={headline} onChange={(e) => setHeadline(clip(e.target.value, HEADLINE_MAX))} className="text-base" />
            </div>
            <div>
              <Label htmlFor="subline">
                {t("promo.studio.subline")} <span className="text-ink-400">({Array.from(subline).length}/{SUBLINE_MAX})</span>
              </Label>
              <Input id="subline" value={subline} onChange={(e) => setSubline(clip(e.target.value, SUBLINE_MAX))} className="text-base" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-700">{t("promo.studio.accent")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {swatches.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c === studio.logoColor ? t("promo.studio.logo_color") : c}
                    aria-pressed={accent === c}
                    onClick={() => setAccent(c)}
                    className={cn("relative h-11 w-11 rounded-full border-2", focusRing, accent === c ? "border-ink-900 dark:border-white" : "border-transparent")}
                    style={{ background: c }}
                  >
                    {c === studio.logoColor && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-white px-1 text-[9px] font-bold text-ink-700 shadow">LOGO</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-700">{t("promo.studio.photo")}</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  aria-pressed={photoUrl === null}
                  className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-ink-400", focusRing, photoUrl === null ? "border-crimson-500 ring-2 ring-crimson-500/30" : "border-ink-200")}
                  title={t("promo.studio.auto_photo")}
                >
                  <ImageOff size={18} />
                </button>
                {studio.uploadsEnabled && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    aria-label={t("promo.studio.upload_photo")}
                    title={t("promo.studio.upload_photo")}
                    className={cn("flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-ink-300 text-[10px] font-semibold text-ink-600 hover:border-crimson-400 disabled:opacity-60", focusRing)}
                  >
                    <Upload size={16} />
                    {uploading ? "…" : t("promo.studio.upload_short")}
                  </button>
                )}
                {[...uploads, ...studio.photos.filter((p) => !uploads.includes(p))].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhotoUrl(p)}
                    aria-pressed={photoUrl === p}
                    className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-lg border", focusRing, photoUrl === p ? "border-crimson-500 ring-2 ring-crimson-500/30" : "border-ink-200")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              {studio.photos.length === 0 && uploads.length === 0 && (
                <p className="mt-1 text-xs text-ink-500">{studio.uploadsEnabled ? t("promo.studio.no_photos_upload") : t("promo.studio.no_photos")}</p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 text-sm">
                {t("promo.studio.show_rating")}
                <Switch checked={showRating && baseModel.averageRating != null} onCheckedChange={setShowRating} aria-label={t("promo.studio.show_rating")} />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 text-sm">
                {t("promo.studio.show_qr")}
                <Switch checked={showQr} onCheckedChange={setShowQr} aria-label={t("promo.studio.show_qr")} />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 text-sm">
                {t("promo.studio.show_price")}
                <Switch checked={showPrice} onCheckedChange={setShowPrice} aria-label={t("promo.studio.show_price")} />
              </label>
            </div>
            {baseModel.averageRating == null && <p className="text-xs text-ink-500">{t("promo.studio.no_rating_yet")}</p>}
          </section>
        )}

        {kind && baseModel && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-900">{t("promo.studio.caption")}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(["friendly", "premium", "urgent"] as const).map((tn) => (
                  <Chip key={tn} active={tone === tn} onClick={() => setTone(tn)}>
                    {t(`promo.studio.tone_${tn}`)}
                  </Chip>
                ))}
                <Button variant="outline" size="sm" onClick={writeForMe} loading={captionBusy} className="min-h-11">
                  <Sparkles size={15} /> {t("promo.studio.write_for_me")}
                </Button>
              </div>
            </div>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} maxLength={2000} className="text-base" placeholder={t("promo.studio.caption_placeholder")} />
            {captions && (
              <div className="space-y-2">
                <p className="text-xs text-ink-500">
                  {captions.source === "AI" ? t("promo.studio.ai_note") : t("promo.studio.template_note")} · {t("promo.studio.remaining", { n: captions.remainingToday })}
                </p>
                {[...captions.bn, ...captions.en].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCaption(c)}
                    className={cn("block w-full rounded-xl border border-ink-100 p-3 text-left text-sm hover:border-crimson-300", focusRing, caption === c && "border-crimson-500")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {kind && baseModel && (
          <section className="hidden flex-wrap gap-2 lg:flex">
            <Button onClick={() => submit(true)} loading={busy === "post"} disabled={!ready || outOfPosts || busy !== null}>
              {t("promo.studio.post")}
            </Button>
            <Button variant="outline" onClick={() => submit(false)} loading={busy === "draft"} disabled={!ready || busy !== null}>
              {t("promo.studio.save_draft")}
            </Button>
            <Button variant="ghost" onClick={() => download("SQUARE")} disabled={!ready || busy !== null}>
              <Download size={15} /> {t("promo.studio.download_square")}
            </Button>
            <Button variant="ghost" onClick={() => download("STORY")} disabled={!ready || busy !== null}>
              <Download size={15} /> {t("promo.studio.download_story")}
            </Button>
          </section>
        )}
        {!outOfPosts && <p className="text-xs text-ink-500">{t("promo.studio.remaining_week", { n: studio.postsRemainingThisWeek })}</p>}
      </div>

      {/* Mobile: sticky primary action (safe-area aware) */}
      {kind && baseModel && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-ink-100 bg-surface/95 px-4 pt-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <Button className="min-h-11 flex-1" onClick={() => submit(true)} loading={busy === "post"} disabled={!ready || outOfPosts || busy !== null}>
            {t("promo.studio.post")}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => submit(false)} loading={busy === "draft"} disabled={!ready || busy !== null}>
            {t("promo.studio.save_draft")}
          </Button>
          <Button variant="outline" className="min-h-11" aria-label={t("promo.studio.download_square")} onClick={() => download("SQUARE")} disabled={!ready || busy !== null}>
            <Download size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

/** The large preview, sized to its column. */
function PreviewSized({ model }: { model: PromoRenderModel }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(440, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <CreativePreview model={model} width={width} />
    </div>
  );
}
