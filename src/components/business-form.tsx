"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  businessApi,
  catalogApi,
  galleryApi,
  listingApi,
  referenceApi,
  uploadFileToPresignedUrl,
} from "@/lib/api";
import { PRICE_TIER_LABELS, priceTierLabel } from "@/lib/config";
import { useLanguage } from "@/lib/language-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import type {
  Area,
  BusinessAttribute,
  BusinessResponse,
  Category,
  CategoryKind,
  City,
  CreateBusinessRequest,
  PriceTier,
} from "@/lib/types";
import { modulesForKind } from "@/lib/category-modules";
import { Button } from "./ui/button";
import { PendingChangeBanner, changedLabels } from "./owner/pending-change-banner";
import { BusinessFaqManager } from "./business-faq-manager";
import { BusinessGalleryManager } from "./business-gallery-manager";
import { CategoryModulesManager } from "./category-modules/category-modules-manager";
import {
  CategoryModulesDraft,
  emptyCatalogDraft,
  type CatalogDraft,
} from "./category-modules/category-modules-draft";
import { LeafletLocationPicker } from "./leaflet-location-picker";
import { HoursExceptionsManager } from "./hours-exceptions-manager";
import {
  buildSummary,
  DEFAULT_DAY,
  hoursFromApiEntries,
  hoursToApiEntries,
  makeWeek,
  OperatingHoursPicker,
  type DayHours,
  type DayKey,
} from "./operating-hours-picker";
import { FieldHint, Input, Label, Select, Textarea } from "./ui/field";
import { ErrorBanner, Spinner } from "./ui/misc";

interface Props {
  existing?: BusinessResponse;
  /** Handoff from the "search first" pre-step — typically just the searched name, so it isn't retyped. */
  initialValues?: Partial<Pick<CreateBusinessRequest, "name" | "categoryId" | "cityId" | "areaId">>;
}

const emptyForm: CreateBusinessRequest = {
  name: "",
  categoryId: "",
  cityId: "",
  areaId: "",
  contactNumber: "",
  operatingHours: "",
  description: "",
  establishedYear: null,
  coverPhotoUrl: "",
  logoUrl: "",
  latitude: 23.780636,
  longitude: 90.419559,
  priceTier: "MODERATE",
  attributeIds: [],
  websiteUrl: "",
  whatsappNumber: "",
  email: "",
  facebookUrl: "",
  instagramUrl: "",
};

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-crimson-600 to-crimson-500 text-xs font-semibold text-white shadow-sm">
        {step}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-200/70 bg-white shadow-sm p-5 md:p-6 h-full">
      {children}
    </div>
  );
}

export function BusinessForm({ existing, initialValues }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const { t, lang } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [attributes, setAttributes] = useState<BusinessAttribute[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // Brand → Branches — create-mode only (editing a listing's brand is an admin-panel action,
  // see business-review-backend's BusinessForm). Self-service linking only offers brands the
  // owner already has another business under, sourced from their own listings rather than a
  // full brand directory — matches the backend's ownership check exactly, so this picker can
  // never lead to the 403 "needs admin approval" case.
  const [ownBrands, setOwnBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandMode, setBrandMode] = useState<"none" | "existing" | "new">("none");

  const [form, setForm] =
    useState<CreateBusinessRequest>(() => (initialValues ? { ...emptyForm, ...initialValues } : emptyForm));

  // Structured weekly hours (separate from form.operatingHours, the legacy free-text
  // summary derived from this on every edit) — starts blank/untouched for a new
  // listing, hydrated from existing.structuredHours below when editing one that
  // already has it. Only sent to businessApi.updateHours on submit if touched,
  // so editing a legacy-only listing without touching the picker never forces
  // structured hours into existence.
  const [hoursState, setHoursState] = useState<Record<DayKey, DayHours>>(() => makeWeek(() => ({ ...DEFAULT_DAY })));
  const [hoursTouched, setHoursTouched] = useState(false);

  function updateHours(next: Record<DayKey, DayHours>) {
    setHoursState(next);
    setHoursTouched(true);
    set("operatingHours", buildSummary(next));
  }

  /*
   * Create-mode only: category-detail rows (menu / services / staff / …) are
   * buffered here because there's no business id to POST them against yet.
   * They're flushed to the catalog API right after the business is created.
   * In edit mode the live <CategoryModulesManager /> is used instead.
   */
  const [catalog, setCatalog] = useState<CatalogDraft>(emptyCatalogDraft);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  /*
   * New business flow:
   *
   * A business ID does not exist before creation.
   * So the selected cover file is kept locally first.
   * After the business is created, the file is uploaded
   * using the newly created business ID.
   */
  const [pendingCoverFile, setPendingCoverFile] =
    useState<File | null>(null);

  const [pendingCoverPreview, setPendingCoverPreview] =
    useState<string | null>(null);

  /* Same pending-until-creation pattern as the cover photo, for the profile picture. */
  const [pendingLogoFile, setPendingLogoFile] =
    useState<File | null>(null);

  const [pendingLogoPreview, setPendingLogoPreview] =
    useState<string | null>(null);

  /*
   * Load reference data
   */
  useEffect(() => {
    Promise.all([
      referenceApi.categories(),
      referenceApi.cities(),
      referenceApi.attributes(),
    ])
      .then(([cats, cityList, attrs]) => {
        setCategories(cats);
        setCities(cityList);
        setAttributes(attrs);
      })
      .catch((err) => {
        show(errorMessage(err), "error");
      })
      .finally(() => {
        setLoadingRef(false);
      });
  }, [show]);

  useEffect(() => {
    if (existing) return;
    businessApi
      .mine()
      .then((mine) => {
        const seen = new Map<string, string>();
        for (const b of mine) {
          if (b.brandId && b.brandName && !seen.has(b.brandId)) {
            seen.set(b.brandId, b.brandName);
          }
        }
        setOwnBrands(Array.from(seen, ([id, name]) => ({ id, name })));
      })
      .catch(() => {});
  }, [existing]);

  /*
   * Load existing business data
   */
  useEffect(() => {
    if (!existing) return;

    setForm((prev) => ({
      ...prev,
      name: existing.name,
      contactNumber: existing.contactNumber,
      operatingHours: existing.operatingHours ?? "",
      description: existing.description ?? "",
      establishedYear: existing.establishedYear ?? null,
      coverPhotoUrl: existing.coverPhotoUrl ?? "",
      logoUrl: existing.logoUrl ?? "",
      latitude: existing.latitude,
      longitude: existing.longitude,
      priceTier: existing.priceTier,
      websiteUrl: existing.websiteUrl ?? "",
      whatsappNumber: existing.whatsappNumber ?? "",
      email: existing.email ?? "",
      facebookUrl: existing.facebookUrl ?? "",
      instagramUrl: existing.instagramUrl ?? "",
    }));

    // Hydrate from real structured data only (never guessed from the legacy free-text
    // string above) — if the listing already has hours set via this picker, edit mode
    // shows them pre-filled instead of blank, and re-saving is a no-op full-replace.
    const structured = hoursFromApiEntries(existing.structuredHours);
    if (structured) {
      setHoursState(structured);
      setHoursTouched(true);
    }
  }, [existing]);

  /*
   * Set category and city for existing business
   */
  useEffect(() => {
    if (
      !existing ||
      categories.length === 0 ||
      cities.length === 0
    ) {
      return;
    }

    const category = categories.find(
      (c) => c.name === existing.categoryName
    );

    const city = cities.find(
      (c) => c.name === existing.cityName
    );

    setForm((prev) => ({
      ...prev,
      categoryId: category?.id ?? prev.categoryId,
      cityId: city?.id ?? prev.cityId,
    }));
  }, [existing, categories, cities]);

  /*
   * Load areas whenever city changes
   */
  useEffect(() => {
    if (!form.cityId) {
      setAreas([]);
      return;
    }

    referenceApi
      .areas(form.cityId)
      .then((list) => {
        setAreas(list);

        if (existing) {
          const area = list.find(
            (a) => a.name === existing.areaName
          );

          if (area) {
            setForm((prev) => ({
              ...prev,
              areaId: area.id,
            }));
          }
        }
      })
      .catch((err) => {
        setAreas([]);
        show(errorMessage(err), "error");
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cityId]);

  /*
   * Set attributes for existing business
   */
  useEffect(() => {
    if (!existing || attributes.length === 0) return;

    const ids = attributes
      .filter((a) =>
        existing.attributes.includes(a.name)
      )
      .map((a) => a.id);

    setForm((prev) => ({
      ...prev,
      attributeIds: ids,
    }));
  }, [existing, attributes]);

  /*
   * Clean preview URL
   */
  useEffect(() => {
    return () => {
      if (pendingCoverPreview) {
        URL.revokeObjectURL(pendingCoverPreview);
      }
    };
  }, [pendingCoverPreview]);

  useEffect(() => {
    return () => {
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
    };
  }, [pendingLogoPreview]);

  /*
   * Generic form setter
   */
  function set<K extends keyof CreateBusinessRequest>(
    key: K,
    value: CreateBusinessRequest[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  /*
   * Toggle business attribute
   */
  function toggleAttribute(id: string) {
    setForm((prev) => ({
      ...prev,
      attributeIds: prev.attributeIds.includes(id)
        ? prev.attributeIds.filter((a) => a !== id)
        : [...prev.attributeIds, id],
    }));
  }

  /*
   * Use browser/device current location
   */
  function useMyLocationForPin() {
    if (!("geolocation" in navigator)) {
      show(t("business_form.error.geolocation_unsupported"), "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set(
          "latitude",
          Number(pos.coords.latitude.toFixed(6))
        );

        set(
          "longitude",
          Number(pos.coords.longitude.toFixed(6))
        );
      },
      (err) => {
        show(
          err.message || t("business_form.error.location_unavailable"),
          "error"
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  /*
   * Upload cover photo for an existing business
   */
  async function handleCoverUpload(
    file: File | undefined
  ) {
    if (!file || !existing) return;

    setUploadingCover(true);

    try {
      const presigned =
        await galleryApi.requestUploadUrl(
          existing.id,
          file.name
        );

      await uploadFileToPresignedUrl(
        presigned.uploadUrl,
        file
      );

      set(
        "coverPhotoUrl",
        presigned.cdnUrlAfterUpload
      );

      show(t("business_form.toast.cover_uploaded"), "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploadingCover(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  /*
   * Select cover photo BEFORE business creation.
   *
   * The file is only kept locally.
   * Actual upload happens after business creation.
   */
  function handlePendingCoverSelect(
    file: File | undefined
  ) {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      show(
        t("business_form.error.invalid_image_type"),
        "error"
      );

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      return;
    }

    /*
     * Revoke previous preview URL
     */
    if (pendingCoverPreview) {
      URL.revokeObjectURL(pendingCoverPreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setPendingCoverFile(file);
    setPendingCoverPreview(previewUrl);
  }

  /*
   * Upload a cover photo after the business has been created.
   */
  async function uploadCoverFor(
    businessId: string,
    file: File
  ): Promise<string> {
    const presigned =
      await galleryApi.requestUploadUrl(
        businessId,
        file.name
      );

    await uploadFileToPresignedUrl(
      presigned.uploadUrl,
      file
    );

    return presigned.cdnUrlAfterUpload;
  }

  /*
   * Upload profile picture for an existing business
   */
  async function handleLogoUpload(
    file: File | undefined
  ) {
    if (!file || !existing) return;

    setUploadingLogo(true);

    try {
      const presigned =
        await galleryApi.requestUploadUrl(
          existing.id,
          file.name
        );

      await uploadFileToPresignedUrl(
        presigned.uploadUrl,
        file
      );

      set(
        "logoUrl",
        presigned.cdnUrlAfterUpload
      );

      show(t("business_form.toast.logo_uploaded"), "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setUploadingLogo(false);

      if (logoFileRef.current) {
        logoFileRef.current.value = "";
      }
    }
  }

  /*
   * Select profile picture BEFORE business creation.
   *
   * The file is only kept locally.
   * Actual upload happens after business creation.
   */
  function handlePendingLogoSelect(
    file: File | undefined
  ) {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      show(
        t("business_form.error.invalid_image_type"),
        "error"
      );

      if (logoFileRef.current) {
        logoFileRef.current.value = "";
      }

      return;
    }

    /*
     * Revoke previous preview URL
     */
    if (pendingLogoPreview) {
      URL.revokeObjectURL(pendingLogoPreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setPendingLogoFile(file);
    setPendingLogoPreview(previewUrl);
  }

  /*
   * Upload a profile picture after the business has been created.
   */
  async function uploadLogoFor(
    businessId: string,
    file: File
  ): Promise<string> {
    const presigned =
      await galleryApi.requestUploadUrl(
        businessId,
        file.name
      );

    await uploadFileToPresignedUrl(
      presigned.uploadUrl,
      file
    );

    return presigned.cdnUrlAfterUpload;
  }

  /*
   * Submit business
   */
  /*
   * Push the buffered category-detail rows to the catalog API for a freshly
   * created business. Sequential on purpose: the server assigns sort_order
   * from the current row count, so this keeps the owner's ordering.
   */
  async function flushCatalog(businessId: string, kind: CategoryKind, draft: CatalogDraft) {
    const active = new Set(modulesForKind(kind).map((m) => m.key));
    const text = (v: string) => (v.trim() ? v.trim() : null);

    if (active.has("services")) {
      for (const r of draft.services) {
        await catalogApi.addService(businessId, {
          name: r.name.trim(),
          description: text(r.description),
          priceText: text(r.priceText),
          section: "OFFERING",
        });
      }
    }
    if (active.has("facilities")) {
      for (const r of draft.facilities) {
        await catalogApi.addService(businessId, {
          name: r.name.trim(),
          description: text(r.description),
          priceText: null,
          section: "FACILITY",
        });
      }
    }
    if (active.has("team")) {
      for (const r of draft.team) {
        await catalogApi.addTeamMember(businessId, {
          name: r.name.trim(),
          role: text(r.role),
          bio: text(r.bio),
        });
      }
    }
    if (active.has("menu")) {
      for (const r of draft.menu) {
        await catalogApi.addMenuItem(businessId, {
          name: r.name.trim(),
          description: text(r.description),
          priceText: text(r.priceText),
          menuSection: text(r.menuSection),
          popular: r.popular,
        });
      }
    }
    if (active.has("products")) {
      for (const r of draft.products) {
        await catalogApi.addProduct(businessId, {
          name: r.name.trim(),
          description: text(r.description),
          priceText: text(r.priceText),
        });
      }
    }
  }

  async function submit() {
    setError(null);

    /*
     * Basic validation
     */
    if (
      !form.name ||
      !form.categoryId ||
      !form.cityId ||
      !form.areaId ||
      !form.contactNumber
    ) {
      setError(t("business_form.error.required_fields"));

      return;
    }

    setSubmitting(true);

    try {
      /*
       * EDIT EXISTING BUSINESS
       */
      if (existing) {
        const updated = await businessApi.update(
          existing.id,
          form
        );

        if (hoursTouched) {
          try {
            await businessApi.updateHours(existing.id, hoursToApiEntries(hoursState));
          } catch {
            show(t("business_form.toast.updated_hours_failed"), "error");
          }
        }

        // V65 protected edits: on a verified listing a new name / phone / address / category
        // waits for approval — say so instead of a plain "saved".
        const held = existing.verified ? await listingApi.pendingChange(existing.id).catch(() => null) : null;
        if (held) {
          show(
            `Saved. ${changedLabels(held).join(", ")} sent for review — your page keeps the current values until approved.`,
            "info"
          );
        } else {
          show(t("business_form.toast.updated"), "success");
        }

        router.push(`/business/${updated.slug}`);

        return;
      }

      /*
       * CREATE NEW BUSINESS
       */
      const created = await businessApi.create(form);

      if (hoursTouched) {
        try {
          await businessApi.updateHours(created.id, hoursToApiEntries(hoursState));
        } catch {
          show(t("business_form.toast.created_hours_failed"), "error");
        }
      }

      /*
       * If a cover photo and/or profile picture were selected before
       * creation, upload them now using the newly created business ID,
       * then apply both URLs in a single update call.
       */
      if (pendingCoverFile || pendingLogoFile) {
        try {
          const [coverUrl, logoUrl] = await Promise.all([
            pendingCoverFile
              ? uploadCoverFor(created.id, pendingCoverFile)
              : Promise.resolve(form.coverPhotoUrl ?? null),
            pendingLogoFile
              ? uploadLogoFor(created.id, pendingLogoFile)
              : Promise.resolve(form.logoUrl ?? null),
          ]);

          await businessApi.update(created.id, {
            ...form,
            coverPhotoUrl: coverUrl,
            logoUrl: logoUrl,
          });

          if (coverUrl) set("coverPhotoUrl", coverUrl);
          if (logoUrl) set("logoUrl", logoUrl);

          show(
            t("business_form.toast.created_with_photos"),
            "success"
          );
        } catch (uploadError) {
          /*
           * Business itself was already created.
           * Only the image upload failed.
           */
          show(
            t("business_form.toast.created_photo_failed"),
            "error"
          );
        }
      } else {
        show(t("business_form.toast.created"), "success");
      }

      /*
       * Flush any category-detail rows entered in step 5. The listing already
       * exists, so a failure here is non-fatal — just point the owner at Edit.
       */
      const selectedCategory = categories.find((c) => c.id === form.categoryId);
      if (selectedCategory) {
        try {
          await flushCatalog(created.id, selectedCategory.kind, catalog);
        } catch {
          show(
            t("business_form.toast.created_category_details_failed"),
            "error"
          );
        }
      }

      router.push(`/owner/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * Loading reference data
   */
  if (loadingRef) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      {existing && (
        <div className="mb-5 empty:hidden">
          <PendingChangeBanner businessId={existing.id} />
        </div>
      )}
      {error && (
        <div className="mb-5">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="space-y-5">

        {/* =========================
            Row 1 — Basic information
        ========================== */}
        <SectionCard>
          <SectionHeader
            step={1}
            title={t("business_form.section.basic_info.title")}
            description={t("business_form.section.basic_info.description")}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="lg:col-span-1">
              <Label htmlFor="name">
                {t("business_form.field.business_name")}
              </Label>

              <Input
                id="name"
                placeholder={t("business_form.field.business_name_placeholder")}
                value={form.name}
                onChange={(e) =>
                  set("name", e.target.value)
                }
              />
            </div>

            <div>
              <Label>{t("business_form.field.category")}</Label>

              <Select
                value={form.categoryId}
                onChange={(e) =>
                  set("categoryId", e.target.value)
                }
              >
                <option value="">
                  {t("business_form.field.select_category")}
                </option>

                {categories.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>{t("business_form.field.price_tier")}</Label>

              <Select
                value={form.priceTier}
                onChange={(e) =>
                  set(
                    "priceTier",
                    e.target.value as PriceTier
                  )
                }
              >
                {Object.keys(
                  PRICE_TIER_LABELS
                ).map((v) => (
                  <option
                    key={v}
                    value={v}
                  >
                    {priceTierLabel(v, lang)}
                  </option>
                ))}
              </Select>
            </div>

          </div>

          {!existing && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <Label>{t("business_form.field.brand")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBrandMode("none");
                    set("brandId", undefined);
                    set("newBrandName", undefined);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    brandMode === "none"
                      ? "border-crimson-500 bg-crimson-50 text-crimson-700"
                      : "border-ink-200 text-ink-600 hover:border-ink-300"
                  }`}
                >
                  {t("business_form.field.brand_none")}
                </button>
                {ownBrands.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrandMode("existing");
                      set("newBrandName", undefined);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      brandMode === "existing"
                        ? "border-crimson-500 bg-crimson-50 text-crimson-700"
                        : "border-ink-200 text-ink-600 hover:border-ink-300"
                    }`}
                  >
                    {t("business_form.field.brand_existing")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBrandMode("new");
                    set("brandId", undefined);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    brandMode === "new"
                      ? "border-crimson-500 bg-crimson-50 text-crimson-700"
                      : "border-ink-200 text-ink-600 hover:border-ink-300"
                  }`}
                >
                  {t("business_form.field.brand_new")}
                </button>
              </div>

              {brandMode === "existing" && (
                <div className="mt-2 max-w-sm">
                  <Select value={form.brandId ?? ""} onChange={(e) => set("brandId", e.target.value || undefined)}>
                    <option value="">{t("business_form.field.select_brand")}</option>
                    {ownBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {brandMode === "new" && (
                <div className="mt-2 max-w-sm">
                  <Input
                    value={form.newBrandName ?? ""}
                    onChange={(e) => set("newBrandName", e.target.value || undefined)}
                    placeholder={t("business_form.field.brand_new_placeholder")}
                  />
                </div>
              )}

              <FieldHint>{t("business_form.field.brand_hint")}</FieldHint>
            </div>
          )}
        </SectionCard>

        {/* =========================
            Row 2 — Location + Details
        ========================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* Location */}
          <SectionCard>
            <SectionHeader
              step={2}
              title={t("business_form.section.location.title")}
              description={t("business_form.section.location.description")}
            />

            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <Label>{t("business_form.field.city")}</Label>

                  <Select
                    value={form.cityId}
                    onChange={(e) =>
                      set("cityId", e.target.value)
                    }
                  >
                    <option value="">
                      {t("business_form.field.select_city")}
                    </option>

                    {cities.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>{t("business_form.field.area")}</Label>

                  <Select
                    value={form.areaId}
                    onChange={(e) =>
                      set("areaId", e.target.value)
                    }
                    disabled={!form.cityId}
                  >
                    <option value="">
                      {t("business_form.field.select_area")}
                    </option>

                    {areas.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>

              </div>

              <LeafletLocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => {
                  set("latitude", lat);
                  set("longitude", lng);
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocationForPin}
              >
                📍 {t("business_form.field.use_my_location")}
              </Button>

              <FieldHint>
                {t("business_form.field.location_hint")}
              </FieldHint>

            </div>
          </SectionCard>

          {/* Contact & Details */}
          <SectionCard>
            <SectionHeader
              step={3}
              title={t("business_form.section.contact_details.title")}
              description={t("business_form.section.contact_details.description")}
            />

            <div className="space-y-4">

              {/* Contact */}
              <div>
                <Label htmlFor="contact">
                  {t("business_form.field.contact_number")}
                </Label>

                <Input
                  id="contact"
                  placeholder="01712345678"
                  value={form.contactNumber}
                  onChange={(e) =>
                    set(
                      "contactNumber",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Operating hours */}
              <div>
                <Label htmlFor="hours">
                  {t("business_form.field.operating_hours")}
                </Label>

                <OperatingHoursPicker
                  hours={hoursState}
                  touched={hoursTouched}
                  onChange={updateHours}
                  legacyValue={form.operatingHours ?? ""}
                />
              </div>

              {/* Holiday / exception hours — existing listings only, saved immediately per-action */}
              {existing && (
                <div>
                  <Label>{t("hours_exceptions.section_title")}</Label>
                  <HoursExceptionsManager businessId={existing.id} initial={existing.hoursExceptions ?? []} />
                </div>
              )}

              {/* Description */}
              <div>
                <Label htmlFor="desc">
                  {t("business_form.field.description")}
                </Label>

                <Textarea
                  id="desc"
                  placeholder={t("business_form.field.description_placeholder")}
                  value={
                    form.description ?? ""
                  }
                  onChange={(e) =>
                    set(
                      "description",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* Established year */}
              <div>
                <Label htmlFor="establishedYear">
                  {t("business_form.field.established_year")}
                </Label>
                <Input
                  id="establishedYear"
                  type="number"
                  inputMode="numeric"
                  placeholder={t("business_form.field.established_year_placeholder")}
                  value={form.establishedYear ?? ""}
                  onChange={(e) =>
                    set("establishedYear", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>

              {/* Cover Photo */}
              <div>
                <Label>
                  {t("business_form.field.cover_photo")}
                </Label>

                {existing ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleCoverUpload(
                          e.target.files?.[0]
                        )
                      }
                      className="text-xs text-ink-500"
                      disabled={uploadingCover}
                    />

                    {uploadingCover && (
                      <span className="ml-2 text-xs text-ink-400">
                        {t("common.uploading")}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handlePendingCoverSelect(
                          e.target.files?.[0]
                        )
                      }
                      className="text-xs text-ink-500"
                      disabled={submitting}
                    />

                    {pendingCoverFile && (
                      <p className="mt-1 text-xs text-ink-500">
                        {t("common.selected_file", { name: pendingCoverFile.name })}
                      </p>
                    )}
                  </>
                )}

                {/* Preview for newly selected image */}
                {pendingCoverPreview && !existing && (
                  <div className="mt-3">
                    <img
                      src={pendingCoverPreview}
                      alt="Cover preview"
                      className="w-full max-h-48 object-cover rounded-xl border border-ink-200"
                    />
                  </div>
                )}

                {/* Existing uploaded URL */}
                {form.coverPhotoUrl && (
                  <p className="mt-1 text-xs text-ink-400 truncate">
                    {form.coverPhotoUrl}
                  </p>
                )}
              </div>

              {/* Profile picture */}
              <div>
                <Label>
                  {t("business_form.field.profile_picture")}
                </Label>
                <FieldHint>
                  {t("business_form.field.profile_picture_hint")}
                </FieldHint>

                <div className="mt-2 flex items-center gap-3">
                  {(pendingLogoPreview && !existing) || form.logoUrl ? (
                    <img
                      src={pendingLogoPreview && !existing ? pendingLogoPreview : form.logoUrl!}
                      alt="Profile picture preview"
                      className="h-14 w-14 rounded-full object-cover border border-ink-200"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-ink-100 border border-ink-200" />
                  )}

                  <div>
                    {existing ? (
                      <>
                        <input
                          ref={logoFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            handleLogoUpload(
                              e.target.files?.[0]
                            )
                          }
                          className="text-xs text-ink-500"
                          disabled={uploadingLogo}
                        />

                        {uploadingLogo && (
                          <span className="ml-2 text-xs text-ink-400">
                            {t("common.uploading")}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <input
                          ref={logoFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            handlePendingLogoSelect(
                              e.target.files?.[0]
                            )
                          }
                          className="text-xs text-ink-500"
                          disabled={submitting}
                        />

                        {pendingLogoFile && (
                          <p className="mt-1 text-xs text-ink-500">
                            {t("common.selected_file", { name: pendingLogoFile.name })}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div>
                <Label>
                  {t("business_form.field.attributes")}
                </Label>

                <div className="flex flex-wrap gap-2">

                  {attributes.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        toggleAttribute(a.id)
                      }
                      className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                        form.attributeIds.includes(
                          a.id
                        )
                          ? "border-crimson-600 bg-crimson-50 text-crimson-800"
                          : "border-ink-200 text-ink-600 hover:border-ink-300"
                      }`}
                    >
                      {form.attributeIds.includes(
                        a.id
                      ) && "✓ "}
                      {a.name}
                    </button>
                  ))}

                </div>
              </div>

            </div>
          </SectionCard>
        </div>

        {/* =========================
            Row 3 — Business presence (optional)
        ========================== */}
        <SectionCard>
          <SectionHeader
            step={4}
            title={t("business_form.section.presence.title")}
            description={t("business_form.section.presence.description")}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="websiteUrl">{t("business_form.field.website")}</Label>
              <Input
                id="websiteUrl"
                type="url"
                inputMode="url"
                placeholder="https://yourbusiness.com"
                value={form.websiteUrl ?? ""}
                onChange={(e) => set("websiteUrl", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="whatsapp">{t("business_form.field.whatsapp")}</Label>
              <Input
                id="whatsapp"
                inputMode="tel"
                placeholder="01712345678"
                value={form.whatsappNumber ?? ""}
                onChange={(e) => set("whatsappNumber", e.target.value)}
              />
              {form.contactNumber && form.contactNumber !== form.whatsappNumber && (
                <button
                  type="button"
                  onClick={() => set("whatsappNumber", form.contactNumber)}
                  className="mt-1 text-xs font-medium text-crimson-700 hover:underline"
                >
                  {t("business_form.field.use_contact_for_whatsapp")}
                </button>
              )}
            </div>

            <div>
              <Label htmlFor="email">{t("business_form.field.email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder="hello@yourbusiness.com"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="facebookUrl">{t("business_form.field.facebook")}</Label>
              <Input
                id="facebookUrl"
                type="url"
                placeholder="https://facebook.com/yourpage"
                value={form.facebookUrl ?? ""}
                onChange={(e) => set("facebookUrl", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="instagramUrl">{t("business_form.field.instagram")}</Label>
              <Input
                id="instagramUrl"
                type="url"
                placeholder="https://instagram.com/yourhandle"
                value={form.instagramUrl ?? ""}
                onChange={(e) => set("instagramUrl", e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* =========================
            Row 4 — Category-specific details (optional, dynamic)
        ========================== */}
        {(() => {
          const selectedCategory = categories.find((c) => c.id === form.categoryId);
          const moduleLabels = selectedCategory
            ? modulesForKind(selectedCategory.kind).map((m) => m.ownerLabel.toLowerCase())
            : [];
          return (
            <SectionCard>
              <SectionHeader
                step={5}
                title={t("business_form.section.category_details.title")}
                description={
                  selectedCategory
                    ? t("business_form.section.category_details.description_with_category", {
                        category: selectedCategory.name.toLowerCase(),
                        modules: moduleLabels.join(", "),
                      })
                    : t("business_form.section.category_details.description")
                }
              />

              {!selectedCategory ? (
                <FieldHint>{t("business_form.field.pick_category_hint")}</FieldHint>
              ) : existing ? (
                <CategoryModulesManager businessId={existing.id} kind={selectedCategory.kind} />
              ) : (
                <>
                  <CategoryModulesDraft
                    kind={selectedCategory.kind}
                    value={catalog}
                    onChange={setCatalog}
                  />
                  <FieldHint>
                    {t("business_form.field.category_details_save_hint")}
                  </FieldHint>
                </>
              )}
            </SectionCard>
          );
        })()}

        {/* =========================
            Row 5 — Photos / gallery (optional)
        ========================== */}
        <SectionCard>
          <SectionHeader
            step={6}
            title={t("business_form.section.photos.title")}
            description={t("business_form.section.photos.description")}
          />

          {existing ? (
            <BusinessGalleryManager businessId={existing.id} />
          ) : (
            <FieldHint>
              {t("business_form.field.photos_save_hint")}
            </FieldHint>
          )}
        </SectionCard>

        {/* =========================
            Row 6 — FAQ (optional)
        ========================== */}
        <SectionCard>
          <SectionHeader
            step={7}
            title={t("business_form.section.faq.title")}
            description={t("business_form.section.faq.description")}
          />

          {existing ? (
            <BusinessFaqManager businessId={existing.id} />
          ) : (
            <FieldHint>
              {t("business_form.field.faq_save_hint")}
            </FieldHint>
          )}
        </SectionCard>

        {/* =========================
            Actions
        ========================== */}
        <div className="flex justify-end gap-2 pt-2 pb-4">

          <Button
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>

          <Button
            onClick={submit}
            loading={submitting}
          >
            {existing
              ? t("business_form.action.save_changes")
              : t("business_form.action.create_listing")}
          </Button>

        </div>

      </div>
    </div>
  );
}