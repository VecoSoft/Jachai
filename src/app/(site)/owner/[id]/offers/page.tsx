"use client";

import { useCallback, useEffect, useState } from "react";
import { catalogApi, offerApi } from "@/lib/api";
import { useOwnerBusiness } from "@/lib/owner-business-context";
import { errorMessage, useToast } from "@/lib/toast-context";
import { formatDate } from "@/lib/utils";
import { OFFER_STATUS_META, OFFER_TYPES, OFFER_TYPE_HAS_NUMERIC_VALUE, offerDiscountLabel } from "@/lib/offer-constants";
import type { CreateOfferBody, MenuItem, OfferAvailability, OfferResponse, OfferType } from "@/lib/types";
import { ModulePhotoInput } from "@/components/category-modules/module-photo-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, PageSpinner } from "@/components/ui/misc";
import { PromoteOfferSheet } from "@/components/promo/promote-offer-sheet";

interface Draft {
  title: string;
  offerType: OfferType;
  discountValue: string;
  originalPrice: string;
  offerPrice: string;
  description: string;
  termsAndConditions: string;
  imageUrl: string | null;
  validFrom: string; // datetime-local value
  validUntil: string; // datetime-local value
  availability: OfferAvailability;
  maxTotalRedemptions: string;
  maxRedemptionsPerUser: string;
  /** Optional — an existing menu item this offer's discount applies to. "" = none. */
  menuItemId: string;
  /** When true (and menuItemId is ""), saving creates a brand-new menu item from this offer's own title/price/photo and links it. */
  createNewMenuItem: boolean;
}

function emptyDraft(): Draft {
  return {
    title: "",
    offerType: "PERCENTAGE_DISCOUNT",
    discountValue: "",
    originalPrice: "",
    offerPrice: "",
    description: "",
    termsAndConditions: "",
    imageUrl: null,
    validFrom: "",
    validUntil: "",
    availability: "BOTH",
    maxTotalRedemptions: "",
    maxRedemptionsPerUser: "",
    menuItemId: "",
    createNewMenuItem: false,
  };
}

/** "2026-09-17T14:30" (datetime-local) <-> ISO instant, both directions. */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftFromOffer(o: OfferResponse): Draft {
  return {
    title: o.title,
    offerType: o.offerType,
    discountValue: o.discountValue != null ? String(o.discountValue) : "",
    originalPrice: o.originalPrice != null ? String(o.originalPrice) : "",
    offerPrice: o.offerPrice != null ? String(o.offerPrice) : "",
    description: o.description ?? "",
    termsAndConditions: o.termsAndConditions ?? "",
    imageUrl: o.imageUrl,
    validFrom: toDateTimeLocal(o.validFrom),
    validUntil: toDateTimeLocal(o.validUntil),
    availability: o.availability,
    maxTotalRedemptions: o.maxTotalRedemptions != null ? String(o.maxTotalRedemptions) : "",
    maxRedemptionsPerUser: o.maxRedemptionsPerUser != null ? String(o.maxRedemptionsPerUser) : "",
    menuItemId: o.menuItemId ?? "",
    createNewMenuItem: false,
  };
}

function draftToBody(d: Draft, businessId: string): CreateOfferBody {
  const numeric = OFFER_TYPE_HAS_NUMERIC_VALUE[d.offerType];
  return {
    businessId,
    title: d.title.trim(),
    offerType: d.offerType,
    discountValue: numeric && d.discountValue !== "" ? Number(d.discountValue) : null,
    originalPrice: d.originalPrice !== "" ? Number(d.originalPrice) : null,
    offerPrice: d.offerPrice !== "" ? Number(d.offerPrice) : null,
    description: d.description.trim() || null,
    termsAndConditions: d.termsAndConditions.trim() || null,
    imageUrl: d.imageUrl,
    validFrom: new Date(d.validFrom).toISOString(),
    validUntil: new Date(d.validUntil).toISOString(),
    availability: d.availability,
    maxTotalRedemptions: d.maxTotalRedemptions !== "" ? Number(d.maxTotalRedemptions) : null,
    maxRedemptionsPerUser: d.maxRedemptionsPerUser !== "" ? Number(d.maxRedemptionsPerUser) : null,
    menuItemId: d.menuItemId || null,
  };
}

export default function OwnerOffersPage() {
  const { business } = useOwnerBusiness();
  const { show } = useToast();

  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [promoteOffer, setPromoteOffer] = useState<OfferResponse | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    offerApi
      .businessOffersForOwner(business.id)
      .then((res) => setOffers(res.content))
      .catch((err) => show(errorMessage(err), "error"))
      .finally(() => setLoading(false));
  }, [business.id, show]);

  useEffect(load, [load]);

  // Populates the "link to menu item" picker below — restaurants only, so an
  // empty list here just means the picker stays hidden (see `form`).
  const loadMenuItems = useCallback(() => {
    catalogApi
      .menuItems(business.id)
      .then(setMenuItems)
      .catch(() => setMenuItems([]));
  }, [business.id]);

  useEffect(loadMenuItems, [loadMenuItems]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function startAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setAdding(true);
  }
  function startEdit(o: OfferResponse) {
    setDraft(draftFromOffer(o));
    setAdding(false);
    setEditingId(o.id);
  }
  function cancelForm() {
    setAdding(false);
    setEditingId(null);
  }

  async function save() {
    if (!draft.title.trim() || !draft.validFrom || !draft.validUntil) {
      show("Title, Valid From, and Valid Until are required.", "error");
      return;
    }
    const newItemPrice = draft.originalPrice !== "" ? Number(draft.originalPrice)
      : draft.offerPrice !== "" ? Number(draft.offerPrice) : null;
    if (draft.createNewMenuItem && !draft.menuItemId && (newItemPrice === null || newItemPrice <= 0)) {
      show("Set an Original price or Offer price above — a new menu item needs one to be orderable.", "error");
      return;
    }
    setSaving(true);
    try {
      let body = draftToBody(draft, business.id);

      // "Create a new menu item from this offer" — spin up the product first
      // (reusing the offer's own title/price/photo, no separate form), then
      // link the offer to whatever id comes back.
      if (draft.createNewMenuItem && !draft.menuItemId) {
        const newItem = await catalogApi.addMenuItem(business.id, {
          name: draft.title.trim(),
          description: draft.description.trim() || null,
          priceText: null,
          price: newItemPrice,
          available: true,
          photoUrl: draft.imageUrl,
          menuSection: null,
          popular: false,
        });
        body = { ...body, menuItemId: newItem.id };
      }

      const saved = editingId ? await offerApi.update(editingId, body) : await offerApi.create(body);
      cancelForm();
      load();
      loadMenuItems();
      show("Offer saved", "success");
      // V58: a newly live offer → offer to promote it in the community right away.
      if (!editingId && saved?.status === "ACTIVE") setPromoteOffer(saved);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval(id: string) {
    setBusyId(id);
    try {
      const published = await offerApi.submit(id);
      show("Offer published", "success");
      load();
      if (published?.status === "ACTIVE") setPromoteOffer(published);
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelOffer(id: string) {
    if (!confirm("Cancel this offer? It will stop appearing to customers immediately.")) return;
    setBusyId(id);
    try {
      await offerApi.cancel(id);
      show("Offer cancelled", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  const numeric = OFFER_TYPE_HAS_NUMERIC_VALUE[draft.offerType];

  const form = (
    <div className="space-y-3 rounded-xl border border-dashed border-ink-300 bg-sand-50/40 p-4">
      <div>
        <Label>Title</Label>
        <Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. 20% off all pizzas" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Type</Label>
          <Select value={draft.offerType} onChange={(e) => patch({ offerType: e.target.value as OfferType })}>
            {OFFER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {numeric && (
          <div>
            <Label>{draft.offerType === "PERCENTAGE_DISCOUNT" ? "Discount %" : "Discount amount (৳)"}</Label>
            <Input
              type="number"
              min={0}
              value={draft.discountValue}
              onChange={(e) => patch({ discountValue: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Original price (optional)</Label>
          <Input type="number" min={0} value={draft.originalPrice} onChange={(e) => patch({ originalPrice: e.target.value })} />
        </div>
        <div>
          <Label>Offer price (optional)</Label>
          <Input type="number" min={0} value={draft.offerPrice} onChange={(e) => patch({ offerPrice: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-ink-200 bg-surface p-3">
        <Label>Menu item</Label>
        {menuItems.length > 0 && (
          <div>
            <Select
              value={draft.menuItemId}
              disabled={draft.createNewMenuItem}
              onChange={(e) => patch({ menuItemId: e.target.value })}
            >
              <option value="">— Not linked to an existing item —</option>
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.price != null ? ` (৳${item.price})` : ""}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-400">
              While this offer is active, that item&apos;s card on your Menu shows the offer price instead — no
              separate duplicate item, and it reverts on its own once the offer ends.
            </p>
          </div>
        )}

        <label className="flex items-start gap-2 pt-1 text-xs text-ink-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={draft.createNewMenuItem}
            disabled={!!draft.menuItemId}
            onChange={(e) => patch({ createNewMenuItem: e.target.checked })}
          />
          <span>
            This is a new product — add it to the Menu too.
            <span className="block text-ink-400">
              Creates &ldquo;{draft.title.trim() || "this offer's title"}&rdquo; as a new menu item at{" "}
              {draft.originalPrice !== "" ? `৳${draft.originalPrice}` : draft.offerPrice !== "" ? `৳${draft.offerPrice}` : (
                <span className="font-semibold text-rose-600">no price set — fill in Original or Offer price above, or it won&apos;t be orderable</span>
              )}
              , using this offer&apos;s description and photo, and links it — no separate form to fill in.
            </span>
          </span>
        </label>
      </div>

      <div>
        <Label>Description (optional)</Label>
        <Textarea rows={3} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Valid from</Label>
          <Input type="datetime-local" value={draft.validFrom} onChange={(e) => patch({ validFrom: e.target.value })} />
        </div>
        <div>
          <Label>Valid until</Label>
          <Input type="datetime-local" value={draft.validUntil} onChange={(e) => patch({ validUntil: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Availability</Label>
        <Select value={draft.availability} onChange={(e) => patch({ availability: e.target.value as OfferAvailability })}>
          <option value="BOTH">Online &amp; in-store</option>
          <option value="ONLINE">Online only</option>
          <option value="IN_STORE">In-store only</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Max total claims (optional)</Label>
          <Input type="number" min={1} value={draft.maxTotalRedemptions} onChange={(e) => patch({ maxTotalRedemptions: e.target.value })} />
        </div>
        <div>
          <Label>Max claims per customer (optional)</Label>
          <Input type="number" min={1} value={draft.maxRedemptionsPerUser} onChange={(e) => patch({ maxRedemptionsPerUser: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Terms &amp; conditions (optional)</Label>
        <Textarea rows={2} value={draft.termsAndConditions} onChange={(e) => patch({ termsAndConditions: e.target.value })} />
      </div>

      <ModulePhotoInput businessId={business.id} value={draft.imageUrl} onChange={(url) => patch({ imageUrl: url })} label="Image (optional)" />

      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={saving}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelForm}>
          Cancel
        </Button>
      </div>
    </div>
  );

  if (!business.verified) {
    return (
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Offers</h2>
        <EmptyState
          title="Verification required"
          description="Only verified businesses can publish offers. Your business is verified automatically once your ownership claim is approved."
        />
      </div>
    );
  }

  return (
    <div>
      {promoteOffer && <PromoteOfferSheet businessId={business.id} offer={promoteOffer} onClose={() => setPromoteOffer(null)} />}
      <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">Offers</h2>
      <p className="mb-4 text-sm text-ink-500">Publish a time-boxed discount — offers go live immediately.</p>

      <RedeemCodeBox />

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="mt-6 space-y-3">
          {offers.length === 0 && !adding && <p className="text-sm text-ink-400">No offers yet.</p>}

          <ul className="space-y-2">
            {offers.map((o) => {
              const meta = OFFER_STATUS_META[o.effectiveStatus];
              return (
                <li key={o.id} className="rounded-xl border border-ink-200/70 bg-white p-3">
                  {editingId === o.id ? (
                    form
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="text-sm font-semibold text-ink-900">{o.title}</span>
                          <span className="text-xs text-ink-400">{offerDiscountLabel(o)}</span>
                        </div>
                        <p className="mt-1 text-xs text-ink-400">
                          {formatDate(o.validFrom)} – {formatDate(o.validUntil)}
                          {o.menuItemName && <> · Linked to <span className="font-medium text-ink-600">{o.menuItemName}</span></>}
                        </p>
                        {o.status === "REJECTED" && o.rejectionReason && (
                          <p className="mt-1 text-xs text-rose-600">Rejected: {o.rejectionReason}</p>
                        )}
                        <p className="mt-1.5 text-xs text-ink-500">
                          {o.viewCount} views · {o.claimCount} claims · {o.redemptionCount} redemptions
                        </p>
                      </div>
                      <div className="flex flex-none flex-wrap gap-1">
                        {(o.status === "DRAFT" || o.status === "PENDING_APPROVAL" || o.status === "ACTIVE" || o.status === "REJECTED") && (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(o)}>
                            Edit
                          </Button>
                        )}
                        {(o.status === "DRAFT" || o.status === "REJECTED") && (
                          <Button size="sm" variant="ghost" onClick={() => submitForApproval(o.id)} loading={busyId === o.id}>
                            Publish
                          </Button>
                        )}
                        {o.status !== "CANCELLED" && o.effectiveStatus !== "EXPIRED" && (
                          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => cancelOffer(o.id)} loading={busyId === o.id}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {adding ? (
            form
          ) : (
            <Button size="sm" variant="outline" onClick={startAdd}>
              + Create offer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** In-store staff redemption box — types/scans a customer's code to mark it redeemed. */
function RedeemCodeBox() {
  const { show } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const claim = await offerApi.redeem(code.trim());
      show(`Redeemed: ${claim.offerTitle ?? "offer"}`, "success");
      setCode("");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-100/70 bg-surface p-3 shadow-card">
      <div className="w-full min-w-0 sm:w-auto sm:min-w-[180px] flex-1">
        <Label>Redeem a customer&apos;s code</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && redeem()}
          placeholder="e.g. VCO-8K42"
          className="font-mono"
        />
      </div>
      <Button size="sm" onClick={redeem} loading={busy}>
        Redeem
      </Button>
    </div>
  );
}