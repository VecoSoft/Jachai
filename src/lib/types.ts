// Types below mirror the Java records/entities in the Spring Boot backend
// (com.bdreview.platform.*) field-for-field, so JSON responses map straight
// through without any renaming layer.

export type UserRole = "CONSUMER" | "BUSINESS_OWNER" | "ADMIN";

export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

export interface DecodedAccessToken {
  sub: string; // user id (UUID)
  role: UserRole;
  iat: number;
  exp: number;
}

export type PreferredLanguage = "en" | "bn";

export interface UserProfile {
  id: string;
  phoneNumber: string;
  role: UserRole;
  name: string | null;
  profilePhotoUrl: string | null;
  preferredLanguage: PreferredLanguage;
  /** Whether this account is paired with an opposite-role account (consumer<->business) — drives the switcher in the nav. */
  hasLinkedAccount: boolean;
  /** Public "Join Community" pseudonymous handle (u/username) — null until the setup flow is completed. */
  communityUsername: string | null;
  /** This account's own Community-facing pseudonymous id — compare against a post/comment's author.id for "is this mine", never against `id`. */
  communityProfileId: string;
  /** Separate from profilePhotoUrl — the avatar shown publicly next to u/{communityUsername}. */
  communityAvatarUrl: string | null;
  /** V59: "M"/"F" picked with the Community username — null for accounts that set a username before it existed. */
  communityGender: CommunityGender | null;
  /** V59: whether the M/F badge is shown to other people (the owner always sees their own choice). */
  communityGenderVisible: boolean;
}

/** V59 community gender badge. */
export type CommunityGender = "M" | "F";

export interface CommunityIdentityResponse {
  communityUsername: string;
  communityGender: CommunityGender | null;
  communityGenderVisible: boolean;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export interface City {
  id: string;
  name: string;
}

export interface Area {
  id: string;
  name: string;
  city?: City;
}

/** Phase 2 — canonical driver of category-specific modules. Free-text category name is unchanged. */
export type CategoryKind = "RESTAURANT" | "CLINIC" | "SALON" | "RETAIL" | "GYM" | "GENERAL";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
}

export interface BusinessAttribute {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------
export type PriceTier = "BUDGET" | "MODERATE" | "EXPENSIVE" | "VERY_EXPENSIVE";

// Business-card reaction row — distinct from VoteType, which is a per-review
// useful/funny/cool vote (see VoteType below).
export type BusinessReactionType = "LIKE" | "DISLIKE" | "LOVE" | "WOW";

export interface BusinessResponse {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  categoryName: string;
  cityName: string;
  areaName: string;
  contactNumber: string;
  operatingHours: string | null;
  description: string | null;
  // Optional trust-building field, "Since {establishedYear}" — null when unset.
  establishedYear: number | null;
  coverPhotoUrl: string | null;
  logoUrl: string | null;
  // "Business presence" (spec Step 4) — optional contact/social links. Null when unset;
  // an empty value is never rendered on the public page.
  websiteUrl: string | null;
  whatsappNumber: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  // Cover photo (if any) followed by gallery photos, in display order — card carousel source.
  photoUrls: string[];
  latitude: number;
  longitude: number;
  priceTier: PriceTier;
  attributes: string[];
  verified: boolean;
  // True once a real (non-admin) owner has claimed this listing — see the claim flow.
  claimed: boolean;
  averageRating: number;
  reviewCount: number;
  // Brand → Branches. Non-null only when this listing is part of a chain. Unlike
  // categoryModules/hasUpdates/etc below, these ARE populated on search/list results too
  // (not just the detail view) — the search grid needs brandId/branchCount to decide whether
  // to render a grouped "N branches" card, and the branch-switcher pill needs them on detail.
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  // True total live branch count for the brand (not just how many are on the current search page).
  branchCount: number | null;
  // Combined rating across every live branch of the brand. Null when brandId is null.
  brandAverageRating: number | null;
  // Set when a LISTING report against this business is resolved ACTION_TAKEN — a visible,
  // Yelp-style "consumer alert" with the report's reason, not a takedown (see report workflow).
  flagged: boolean;
  flagReason: ReportReason | null;
  flaggedAt: string | null;
  // Business-card reaction totals (Like/Dislike/Love/Wow) — a direct reaction
  // to the business as a whole, not derived from review votes.
  totalLikeCount: number;
  totalDislikeCount: number;
  totalLoveCount: number;
  totalWowCount: number;
  // Phase 2 — canonical category classification, drives which module tabs appear.
  categoryKind: CategoryKind;
  // Which category modules actually have data. Populated only on GET /businesses/{slug}
  // (the detail view); null on search/list/mine results. Each tab then fetches its own list.
  categoryModules: CategoryModuleFlags | null;
  // Phase 3 — true if the listing has ≥1 published update. Detail response only; null on lists.
  hasUpdates: boolean | null;
  // True if the listing has ≥1 FAQ entry. Detail response only; null on lists. Lets the
  // "About" tab show even when there's no other about-data, as long as FAQ exists.
  hasFaq: boolean | null;
  // Structured per-day hours (distinct from the legacy free-text `operatingHours` above) —
  // populated on the detail view AND on search/list results (backend batches one query per
  // page, not per row — see BusinessService#search). Null/empty means the business hasn't set
  // structured hours yet, so no "open now" badge is shown (see lib/business-hours.ts) — the
  // legacy free text is never parsed to guess it, it's too unreliable a format.
  structuredHours: OperatingHoursEntry[] | null;
  // Holiday / special-hours date-range overrides — same detail-and-search-both, batched
  // convention as structuredHours. An active exception always takes precedence over the
  // recurring weekly entry (see lib/business-hours.ts).
  hoursExceptions: HoursExceptionEntry[] | null;
  // Always populated (a plain entity column) — drives the card's "New" badge (< 14 days old).
  createdAt: string;
  // Search/list results only (batched, one query per page) — null on the detail response,
  // which shows every review itself so a single excerpt adds nothing there.
  topReviewSnippet: string | null;
  // The one active offer to show as a card badge — same search/list-only, batched convention
  // as topReviewSnippet. Shape matches exactly what offerDiscountLabel() (lib/offer-constants.ts)
  // needs, so the card never has to special-case this vs. a full OfferResponse.
  activeOffer: { title: string; offerType: OfferType; discountValue: number | null } | null;
}

/**
 * One day's structured hours. closeTime <= openTime (when not closed) means the
 * window crosses midnight (e.g. open "20:00", close "02:00") — inferred from the
 * times themselves, no separate flag; mirrors the backend's V38 CHECK constraint.
 * Same shape is used for both reading (BusinessResponse.structuredHours) and
 * writing (businessApi.updateHours request body).
 */
export interface OperatingHoursEntry {
  dayOfWeek: DayOfWeek;
  closed: boolean;
  /** "HH:mm" (LocalTime) — null when closed. */
  openTime: string | null;
  closeTime: string | null;
}

/**
 * A holiday closure or modified/special hours for a date range (e.g. a 3-day Eid
 * closure, or shorter hours on a specific date) — takes precedence over the
 * recurring weekly OperatingHoursEntry for any date(s) it covers. Same
 * closeTime<=openTime cross-midnight convention. Used for both reading
 * (BusinessResponse.hoursExceptions) and writing (businessApi add/update calls).
 */
export interface HoursExceptionEntry {
  id: string;
  /** "YYYY-MM-DD" (LocalDate). */
  startDate: string;
  endDate: string;
  closed: boolean;
  /** "HH:mm" (LocalTime) — null when closed. */
  openTime: string | null;
  closeTime: string | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Phase 2 — category-specific showcase modules
// ---------------------------------------------------------------------------
export interface CategoryModuleFlags {
  hasOfferings: boolean;
  hasFacilities: boolean;
  hasTeam: boolean;
  hasMenu: boolean;
  hasProducts: boolean;
}

/** OFFERING = services / gym membership plans; FACILITY = gym amenity names. */
export type ServiceSection = "OFFERING" | "FACILITY";

export interface ServiceOffering {
  id: string;
  businessId: string;
  section: ServiceSection;
  name: string;
  description: string | null;
  priceText: string | null;
  /** Optional — powers slot generation for booking (minutes). */
  durationMinutes: number | null;
  /** Optional cleanup/travel time appended after the service (minutes). */
  bufferMinutes: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  businessId: string;
  name: string;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Staff scheduling (booking — Salon & Beauty)
// ---------------------------------------------------------------------------
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/** "HH:mm" or "HH:mm:ss" (LocalTime). */
export interface WeeklyScheduleEntry {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface TimeOff {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
}

export interface TimeOffBody {
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/** A service a staff member provides, with an optional per-staff duration/buffer override (null = use the service's own default). */
export interface StaffServiceAssignment {
  serviceId: string;
  durationMinutes: number | null;
  bufferMinutes: number | null;
}

export interface StaffScheduleResponse {
  assignments: StaffServiceAssignment[];
  weeklySchedule: WeeklyScheduleEntry[];
  timeOff: TimeOff[];
}

export interface QueueStatus {
  applicable: boolean;
  position: number | null;
  estimatedWaitMinutes: number | null;
  currentlyServingService: string | null;
}

export interface AvailabilitySlot {
  /** "HH:mm:ss" (LocalTime). */
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  date: string;
  durationMinutes: number;
  bufferMinutes: number;
  slots: AvailabilitySlot[];
}

export interface MenuItem {
  id: string;
  businessId: string;
  menuSection: string | null;
  name: string;
  description: string | null;
  priceText: string | null;
  /** Commerce (Phase A): numeric price — required for the item to be orderable. */
  price: number | null;
  /** Optional "was" price shown struck through next to price; only meaningful when greater than price. */
  compareAtPrice: number | null;
  available: boolean;
  orderingEnabled: boolean;
  photoUrl: string | null;
  popular: boolean;
  sortOrder: number;
  createdAt: string;
  /** Set only when an ACTIVE offer links to this item — see CatalogService#menu. Null otherwise. */
  activeOfferId: string | null;
  /** Set whenever activeOfferId is, even for non-numeric types like BUY_ONE_GET_ONE (where activeOfferPrice stays null). */
  activeOfferType: OfferType | null;
  /** Only set for numeric offer types (percentage/fixed discount) — show this instead of `price` when set. */
  activeOfferPrice: number | null;
}

export interface FeaturedProduct {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  priceText: string | null;
  photoUrl: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ServiceOfferingBody {
  name: string;
  description?: string | null;
  priceText?: string | null;
  section?: ServiceSection;
  durationMinutes?: number | null;
  bufferMinutes?: number | null;
}
export interface TeamMemberBody {
  name: string;
  role?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  active?: boolean;
}
export interface MenuItemBody {
  name: string;
  description?: string | null;
  priceText?: string | null;
  photoUrl?: string | null;
  menuSection?: string | null;
  popular: boolean;
  /** Commerce (Phase A): numeric price + availability / ordering toggles. */
  price?: number | null;
  available?: boolean | null;
  orderingEnabled?: boolean | null;
  /** Optional "was" price; only kept server-side when greater than price. */
  compareAtPrice?: number | null;
}
export interface FeaturedProductBody {
  name: string;
  description?: string | null;
  priceText?: string | null;
  photoUrl?: string | null;
}

/** Owner-answered common question — business-wide, not category-scoped, unlike the modules above. */
export interface Faq {
  id: string;
  businessId: string;
  question: string;
  answer: string;
  sortOrder: number;
  createdAt: string;
}
export interface FaqBody {
  question: string;
  answer: string;
}

/** Quick-reply chip for the chat widget — see components/chat. `language` is set
 *  ("en"/"bn") on a system-seeded default, null on an owner-authored entry (shown
 *  to everyone regardless of site language). */
export interface AutoReply {
  id: string;
  businessId: string;
  question: string;
  answer: string;
  language: string | null;
  systemDefault: boolean;
  sortOrder: number;
  createdAt: string;
}
export interface AutoReplyBody {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Commerce & Fulfillment — Phase A: restaurant direct ordering
// ---------------------------------------------------------------------------
export type CommerceMode = "SHOWCASE_ONLY" | "DIRECT_ORDER" | "BOOKING" | "SERVICE_REQUEST";
export type FulfillmentType = "PICKUP" | "OWN_DELIVERY";
export type PaymentMethod = "CASH_ON_DELIVERY" | "PAY_AT_BUSINESS";
export type PaymentStatus = "UNPAID" | "PAID";
export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";
export type OrderItemSource = "MENU_ITEM" | "PRODUCT";

/** Public-safe subset of a business's commerce config (GET /commerce). */
export interface PublicCommerceView {
  mode: CommerceMode;
  orderingEnabled: boolean;
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  bookingEnabled: boolean;
  acceptingOrders: boolean;
  pauseReason: string | null;
  paymentCashOnDelivery: boolean;
  paymentPayAtBusiness: boolean;
  hasDeliveryZones: boolean;
}

/** Full owner-facing commerce settings (GET /commerce/manage, PUT /commerce). */
export interface CommerceSettings {
  businessId: string;
  mode: CommerceMode;
  orderingEnabled: boolean;
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  bookingEnabled: boolean;
  autoConfirmBookings: boolean;
  acceptingOrders: boolean;
  pauseReason: string | null;
  defaultPrepMinutes: number | null;
  paymentCashOnDelivery: boolean;
  paymentPayAtBusiness: boolean;
  hasDeliveryZones: boolean;
}

export interface CommerceSettingsBody {
  mode: CommerceMode;
  orderingEnabled: boolean;
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  paymentCashOnDelivery: boolean;
  paymentPayAtBusiness: boolean;
  defaultPrepMinutes?: number | null;
}

export interface BookingSettingsBody {
  bookingEnabled: boolean;
  autoConfirmBookings: boolean;
}

export interface DeliveryZone {
  id: string;
  businessId: string;
  name: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedDeliveryMinutes: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface DeliveryZoneBody {
  name: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  deliveryFee: number;
  minimumOrderAmount?: number | null;
  estimatedDeliveryMinutes?: number | null;
  active?: boolean | null;
}

export interface DeliveryQuote {
  deliverable: boolean;
  distanceKm: number;
  zoneId: string | null;
  zoneName: string | null;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  estimatedDeliveryMinutes: number | null;
  maxDeliveryKm: number | null;
}

/** One line of the client-side cart (localStorage). */
export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  /** Snapshotted at add-to-cart time — every pair bills as one, same math as OrderService#placeOrder. */
  isBogo?: boolean;
  /** Snapshotted "was" price (from an active offer's list price, or the item's own compareAtPrice) — only set when it's a real discount, i.e. greater than price. */
  compareAtPrice?: number | null;
}

export interface Cart {
  businessId: string;
  businessName: string;
  businessSlug: string;
  lines: CartLine[];
}

export interface PlaceOrderBody {
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  customerNote?: string | null;
  items: { menuItemId: string; quantity: number }[];
}

export interface OrderItem {
  id: string;
  sourceType: OrderItemSource;
  sourceItemId: string | null;
  itemName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface OrderStatusEvent {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  at: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessPhone: string;
  /** "{area}, {city}" — the business has no separate street-address field. */
  businessAddress: string;
  customerUserId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryDistanceKm: number | null;
  customerNote: string | null;
  rejectionReason: string | null;
  /** Set once the owner accepts the order; null before that. */
  estimatedReadyAt: string | null;
  createdAt: string;
  items: OrderItem[];
  timeline: OrderStatusEvent[] | null;
}

// ---------------------------------------------------------------------------
// Commerce & Fulfillment — Phase C: appointment booking (Salon & Beauty)
// ---------------------------------------------------------------------------
export type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REJECTED" | "NO_SHOW";

export interface PlaceBookingBody {
  serviceId: string;
  staffId?: string | null;
  /** "YYYY-MM-DD" */
  preferredDate: string;
  /** "HH:mm" (24h) */
  preferredTime: string;
  customerName: string;
  customerPhone: string;
  customerNote?: string | null;
}

export interface BookingStatusEvent {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note: string | null;
  at: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  customerUserId: string;
  status: BookingStatus;
  serviceId: string | null;
  serviceName: string;
  staffId: string | null;
  staffName: string | null;
  preferredDate: string;
  preferredTime: string;
  customerName: string;
  customerPhone: string;
  customerNote: string | null;
  rejectionReason: string | null;
  createdAt: string;
  timeline: BookingStatusEvent[] | null;
  autoConfirmed: boolean;
  startedAt: string | null;
}

// ---------------------------------------------------------------------------
// Phase 3 — updates, analytics, profile completeness
// ---------------------------------------------------------------------------
export interface BusinessUpdate {
  id: string;
  businessId: string;
  body: string;
  imageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessUpdateBody {
  body: string;
  imageUrl?: string | null;
  published?: boolean | null;
}

export type BusinessEventType =
  | "PROFILE_VIEW"
  | "PHONE_CLICK"
  | "WHATSAPP_CLICK"
  | "DIRECTIONS_CLICK"
  | "WEBSITE_CLICK"
  | "QR_SCAN";

export type AnalyticsRange = "7d" | "30d" | "all";

export interface AnalyticsResponse {
  range: AnalyticsRange;
  from: string | null;
  profileViews: number;
  phoneClicks: number;
  whatsappClicks: number;
  directionsClicks: number;
  websiteClicks: number;
}

// ---------------------------------------------------------------------------
// Business QR V1
// ---------------------------------------------------------------------------
export type QrStatus = "ACTIVE" | "INACTIVE";

export interface QrInfo {
  businessId: string;
  qrToken: string;
  status: QrStatus;
  createdAt: string;
}

export interface QrResolveResponse {
  businessId: string;
  slug: string;
}

export interface CompletenessItem {
  key: string;
  label: string;
  /** short call-to-action; null for completed items */
  action: string | null;
}

export interface CompletenessResponse {
  percentage: number;
  completed: CompletenessItem[];
  recommended: CompletenessItem[];
}

export interface CreateBusinessRequest {
  name: string;
  categoryId: string;
  cityId: string;
  areaId: string;
  contactNumber: string;
  operatingHours?: string | null;
  description?: string | null;
  establishedYear?: number | null;
  coverPhotoUrl?: string | null;
  logoUrl?: string | null;
  latitude: number;
  longitude: number;
  priceTier: PriceTier;
  attributeIds: string[];
  // "Business presence" (spec Step 4) — all optional; blank is sent as null / treated as absent.
  websiteUrl?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  // Brand → Branches — optional, mutually exclusive. brandId links to an existing chain (only
  // allowed when the owner already owns another business under it); newBrandName starts a new
  // chain. Create-only; there's no owner-facing way to edit a listing's brand after creation
  // (that's an admin-panel-only action for v1 — see business-review-backend's BusinessForm).
  brandId?: string;
  newBrandName?: string;
}

export type UpdateBusinessRequest = CreateBusinessRequest;

/** "trending"/"most_loved" are homepage-carousel-only — not in SORT_LABELS, so they never surface in the manual sort dropdown. */
export type SortOption = "relevance" | "rating" | "distance" | "newest" | "most_reviewed" | "trending" | "most_loved";

export interface BusinessSearchParams {
  categoryId?: string;
  areaId?: string;
  priceTier?: PriceTier;
  minRating?: number;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  /** Free-text search-bar query — business name, category/service keyword, or a natural-language phrase. */
  q?: string;
  /** Free-text location field (e.g. "Mirpur", "Dhanmondi, Dhaka") — matched against area/city names, not a dropdown. */
  location?: string;
  sort?: SortOption;
  page?: number;
  size?: number;
}

/** GET /api/v1/businesses/smart-search — intent-aware search used whenever the search box has text. */
export interface SmartSearchParams {
  q: string;
  categoryId?: string;
  areaId?: string;
  priceTier?: PriceTier;
  minRating?: number;
  /** Only ever sent when the visitor has already granted location — never requested by search itself. */
  lat?: number;
  lng?: number;
  sort?: SortOption;
  page?: number;
  size?: number;
  lang?: "en" | "bn";
}

export interface SmartSearchIntent {
  what: { label: string; icon: string }[];
  keywords: string[];
  location: string | null;
  /** false = the place was recognised but has no listings yet (results then come from all areas). */
  locationKnown: boolean;
  price: "LOW" | "HIGH" | null;
  ratingHigh: boolean;
  nearMe: boolean;
  openNow: boolean;
  /** Set when a typo was fixed — shown as "Showing results for …". */
  correctedQuery: string | null;
}

export interface SmartSearchResponse {
  results: PageResponse<BusinessResponse>;
  intent: SmartSearchIntent;
  /** Already localised; set when a constraint had to be relaxed to find anything. */
  notice: string | null;
  /** The query asked for "near me" but no location was sent. */
  needsLocation: boolean;
  /** business id → up to two short labels ("Menu: Chicken Biryani", "2.4 km from Mirpur"). */
  matchReasons: Record<string, string[]>;
  /** V58: at most one paid result, shown above the organic results with a "Sponsored" label. */
  sponsored?: SponsoredBusiness | null;
}

export type SearchSuggestionType = "CONCEPT" | "CONCEPT_AREA" | "CONCEPT_NEAR" | "AREA" | "BUSINESS" | "POPULAR";

export interface SearchSuggestion {
  type: SearchSuggestionType;
  label: string;
  /** Text to search when picked (BUSINESS rows navigate to `slug` instead). */
  query: string;
  icon: string | null;
  slug: string | null;
  detail: string | null;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export type VisibilityStatus = "RECOMMENDED" | "NOT_RECOMMENDED" | "HIDDEN";
export type VoteType = "USEFUL" | "FUNNY" | "COOL";

export interface ReviewResponse {
  id: string;
  businessId: string;
  userId: string;
  userName: string | null;
  rating: number;
  content: string | null;
  visibilityStatus: VisibilityStatus;
  usefulCount: number;
  funnyCount: number;
  coolCount: number;
  editable: boolean;
  photoUrls: string[];
  createdAt: string;
  // Public owner reply ("Response from the owner") — distinct from the private message thread.
  ownerReply: string | null;
  ownerRepliedAt: string | null;
}

// Shape returned by the admin moderation "flagged reviews" endpoint
// (com.bdreview.platform.moderation.FlaggedReviewResponse) — thinner than
// ReviewResponse, no photo URLs resolved.
export interface Review {
  id: string;
  businessId: string;
  userId: string;
  userName: string | null;
  rating: number;
  content: string | null;
  visibilityStatus: VisibilityStatus;
  suspicionScore: number;
  usefulCount: number;
  funnyCount: number;
  coolCount: number;
  createdAt: string;
}

// Home page "Recent Activity" feed — one row per public review, pre-joined
// with just enough business + reviewer context to render a card without a
// second round trip per item (com.bdreview.platform.review.RecentActivityResponse).
export interface RecentActivityItem {
  reviewId: string;
  businessId: string;
  businessName: string | null;
  businessSlug: string | null;
  businessCoverPhotoUrl: string | null;
  businessCategoryName: string | null;
  userId: string;
  userName: string | null;
  rating: number;
  content: string | null;
  photoUrls: string[];
  usefulCount: number;
  funnyCount: number;
  coolCount: number;
  createdAt: string;
}

// Business detail page "Overall rating" bar chart (com.bdreview.platform.review.RatingBreakdownResponse).
export interface RatingBreakdown {
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
  total: number;
}

export type ReviewSortOption = "newest" | "highest" | "lowest";

export interface SubmitReviewRequest {
  businessId: string;
  rating: number;
  content: string;
  photoUrls: string[];
}

export interface UpdateReviewRequest {
  rating: number;
  content: string;
}

// ---------------------------------------------------------------------------
// Business claim
// ---------------------------------------------------------------------------
export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VerificationMethod = "PHONE" | "EMAIL" | "DOCUMENT";

export interface BusinessClaim {
  id: string;
  businessId: string;
  claimantUserId: string;
  claimantName: string | null;
  verificationMethod: VerificationMethod;
  status: ClaimStatus;
  createdAt: string;
  resolvedAt: string | null;
}

// ---------------------------------------------------------------------------
// Bookmarks / Collections
// ---------------------------------------------------------------------------
export interface Bookmark {
  id: string;
  userId: string;
  businessId: string;
  collectionId: string | null;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export type ReportTargetType = "REVIEW" | "LISTING" | "COMMUNITY_POST" | "COMMUNITY_COMMENT" | "OFFER";
export type ReportReason = "SPAM" | "FAKE" | "OFFENSIVE" | "OTHER";
// PENDING is the only non-terminal value; the other three are resolution
// outcomes an admin chooses on resolve — see ResolveReportRequest below.
export type ReportStatus = "PENDING" | "ACTION_TAKEN" | "DISMISSED" | "DUPLICATE";
export type ReportPriority = "HIGH" | "NORMAL";

export interface Report {
  id: string;
  reporterUserId: string;
  reporterName: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ReportStatus;
  referenceCode: string;
  resolutionNote: string | null;
  reporterNotifiedAt: string | null;
  targetOwnerNotifiedAt: string | null;
  priority: ReportPriority;
  dueAt: string;
  isOverdue: boolean;
  createdAt: string;
}

/** outcome must be ACTION_TAKEN, DISMISSED, or DUPLICATE — never PENDING (rejected server-side). */
export interface ResolveReportRequest {
  outcome: Exclude<ReportStatus, "PENDING">;
  resolutionNote?: string | null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationType =
  | "REPORT_SUBMITTED"
  | "REPORT_ACTION_TAKEN"
  | "REPORT_DISMISSED"
  | "CONTENT_HIDDEN"
  | "LISTING_FLAGGED"
  | "OFFER_CLAIMED"
  | "OFFER_REDEEMED"
  | "OFFER_APPROVED"
  | "OFFER_REJECTED";
export type NotificationChannel = "SMS" | "IN_APP";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ";

export interface Notification {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResponse {
  notifications: PageResponse<Notification>;
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Moderation / audit
// ---------------------------------------------------------------------------
export interface ModerationQueueCounts {
  pendingReports: number;
  flaggedReviews: number;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedByAdmin: string;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fake-review signals
// ---------------------------------------------------------------------------
export type FakeReviewSignalType =
  | "CONTENT_PATTERN"
  | "TIMING_PATTERN"
  | "RATING_CLUSTERING";

export interface FakeReviewSignal {
  id: string;
  reviewId: string;
  signalType: FakeReviewSignalType;
  score: number;
  detail: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export interface MessageThread {
  id: string;
  consumerUserId: string;
  consumerName: string | null;
  businessId: string;
  createdAt: string;
  unreadCount: number;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
  reactions: ReactionSummary[];
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
export interface PreSignedUploadResponse {
  uploadUrl: string;
  objectKey: string;
  cdnUrlAfterUpload: string;
}

export interface ConfirmUploadRequestT {
  businessId: string;
  cdnUrl: string;
}

export interface BusinessPhoto {
  id: string;
  businessId: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Paging + errors
// ---------------------------------------------------------------------------
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

// Lightweight local cache entry used to bridge gaps where the backend
// returns only a businessId with no name/slug/photo attached (bookmarks,
// message threads). Populated opportunistically whenever a full
// BusinessResponse passes through the app. See lib/business-cache.ts.
export interface CachedBusinessSummary {
  id: string;
  name: string;
  slug: string;
  coverPhotoUrl: string | null;
  categoryName: string;
  areaName: string;
  cityName: string;
  // Added for the marketplace-style BusinessCard (rating/price/distance) — all optional
  // since a cache entry written before this field existed still deserializes fine, just
  // without it. See business-cache.ts#toBusinessCardData for the "not enough to render
  // the rich card yet" fallback this makes possible.
  priceTier?: PriceTier;
  verified?: boolean;
  averageRating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  branchCount?: number | null;
  createdAt?: string;
}

/** The subset of BusinessResponse the marketplace-style BusinessCard actually reads —
 *  lets it also render from a CachedBusinessSummary (bookmarks/message-thread screens,
 *  which only ever have a businessId — see business-cache.ts), not just a full search
 *  result. latitude/longitude are nullable here (unlike BusinessResponse) for exactly
 *  that case: an older cache entry predating those fields, or one that never saw a
 *  business with a photoUrls array (only a coverPhotoUrl) still satisfies this type. */
export type BusinessCardData = Pick<
  BusinessResponse,
  | "id"
  | "name"
  | "slug"
  | "categoryName"
  | "areaName"
  | "cityName"
  | "photoUrls"
  | "priceTier"
  | "verified"
  | "averageRating"
  | "reviewCount"
  | "flagged"
  | "flagReason"
  | "branchCount"
  | "structuredHours"
  | "hoursExceptions"
  | "createdAt"
  | "topReviewSnippet"
  | "activeOffer"
> & {
  latitude: number | null;
  longitude: number | null;
};

// ---------------------------------------------------------------------------
// "Join Community" V1 — Reddit-style pseudonymous text discussion (formerly
// a Facebook-style content+image feed). Mirrors com.bdreview.platform
// .community's response DTOs field-for-field.
// ---------------------------------------------------------------------------
export type CommunityPostVoteType = "UPVOTE" | "DOWNVOTE";
export type CommunityPostType = "DISCUSSION" | "QUESTION" | "RECOMMENDATION" | "POLL";
/**
 * A community_topic code. Topics are admin-managed (admin panel → Community → Settings) and come
 * from GET /api/v1/community/settings, so this is an open string — the original built-in codes
 * ("FOOD", "HEALTHCARE", …) are still what existing posts carry.
 */
export type CommunityTopic = string;
/** Moderation state — everyone else only ever sees ACTIVE (and REMOVED placeholders); the author may also see PENDING/HIDDEN. */
export type CommunityContentStatus = "ACTIVE" | "PENDING" | "HIDDEN" | "REMOVED" | "DRAFT";
export type CommunityFeedTab = "FOR_YOU" | "FOLLOWING" | "NEARBY";
export type CommunitySortOrder = "NEW" | "TOP";
/** Derived server-side, not stored — see CommunityPostService#questionStatus. Only present when postType === "QUESTION". */
export type CommunityQuestionStatus = "OPEN" | "RESOLVED" | "CLOSED";

/** One card in the "Questions for you" widget — see CommunityPostService#recommendedQuestions. */
export interface CommunityQuestionRecommendation {
  id: string;
  headline: string;
  answerCount: number;
  followerCount: number;
  /** Null if nobody has followed this question yet. */
  lastFollowedAt: string | null;
}

/** Never carries the poster's real name/phone/photo — see CommunityPostService#toAuthorSummary. */
export interface CommunityAuthorSummary {
  id: string;
  communityUsername: string | null;
  reviewCount: number;
  memberSince: string | null;
  verified: boolean;
  /** Separate, optional avatar for this pseudonymous identity — never the real account photo. Null falls back to initials. */
  communityAvatarUrl: string | null;
  /** "Jachai Team" identity on official announcements — not a real community profile (don't link it). */
  official?: boolean;
  /** V59: M/F badge — null when the member hid it or hasn't chosen yet. */
  gender?: CommunityGender | null;
}

export interface CommunityMentionedBusinessSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  verified: boolean;
}

export interface CommunityAreaSummary {
  id: string;
  name: string;
  cityName: string;
}

/** voteCount is null until the viewer has voted (or the poll has closed) — see CommunityPoll. */
export interface CommunityPollOptionResponse {
  id: string;
  label: string;
  voteCount: number | null;
}

export interface CommunityPollResponse {
  id: string;
  options: CommunityPollOptionResponse[];
  totalVotes: number;
  /** Null if the current viewer hasn't voted (or is anonymous). */
  myVoteOptionId: string | null;
  closesAt: string;
  closed: boolean;
}

export interface CommunityPostResponse {
  id: string;
  author: CommunityAuthorSummary;
  title: string | null;
  body: string | null;
  /** The post's photo attachments, in order (or a legacy pre-V1 post's single image as a 1-entry list); empty if none. */
  imageUrls: string[];
  postType: CommunityPostType;
  topic: CommunityTopic;
  area: CommunityAreaSummary | null;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  myVote: CommunityPostVoteType | null;
  commentCount: number;
  /** 0 or 1 entries for a V1 post (single optional business attach). */
  mentionedBusinesses: CommunityMentionedBusinessSummary[];
  /** Non-null only when postType === "POLL". */
  poll: CommunityPollResponse | null;
  /** Non-null only when postType === "QUESTION". */
  questionStatus: CommunityQuestionStatus | null;
  /** Top-level (depth 0) comments only — "Answers" on a QUESTION post. 0 for other post types. */
  answerCount: number;
  createdAt: string;
  updatedAt: string;
  // ---- Moderation (additive; optional so older payloads still type-check) ----
  status?: CommunityContentStatus;
  /** Comments are turned off. */
  locked?: boolean;
  pinned?: boolean;
  featured?: boolean;
  /** "Jachai Team" announcement. */
  official?: boolean;
  /** Only sent to the post's own author when status === "REMOVED". */
  removedReason?: string | null;
  // ---- V58 business promotion (additive) ----
  /** Set when posted AS a business — render the business identity; `author` is then a blank placeholder. */
  business?: BusinessIdentity | null;
  /** Promotion details for a business post (CTA, offer/menu refs, creative, expiry). */
  promotion?: BusinessPostView | null;
  /** Set only on a paid placement injected into a feed — always render a "Sponsored" label. */
  sponsored?: SponsoredInfo | null;
}

// ---------------------------------------------------------------------------
// Business promotion (V58)
// ---------------------------------------------------------------------------
export interface BusinessIdentity {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  verified: boolean;
  areaName: string | null;
}

export type BusinessPostType = "MENU_ITEM" | "OFFER" | "EVENT" | "ANNOUNCEMENT" | "GENERAL";
export type BusinessPostStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "REMOVED" | "EXPIRED";
export type BusinessPostCta = "GET_OFFER" | "ORDER" | "INTERESTED" | "VIEW_BUSINESS";

export interface PromoOfferRef {
  id: string;
  title: string;
  offerType: string | null;
  discountValue: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  validUntil: string;
  active: boolean;
}

export interface PromoMenuItemRef {
  id: string;
  name: string;
  price: number | null;
  priceText: string | null;
  photoUrl: string | null;
  available: boolean;
  orderable: boolean;
}

export interface BusinessPostView {
  type: BusinessPostType;
  status: BusinessPostStatus;
  expired: boolean;
  cta: BusinessPostCta;
  offer: PromoOfferRef | null;
  menuItem: PromoMenuItemRef | null;
  eventStart: string | null;
  eventEnd: string | null;
  creativeId: string | null;
  squareUrl: string | null;
  storyUrl: string | null;
  ogUrl: string | null;
  interestedCount: number;
  interested: boolean;
  /** Owner only. */
  rejectionReason: string | null;
  /** Owner only, and only for a published post while boosts are enabled. */
  canBoost: boolean;
}

export interface SponsoredInfo {
  boostId: string;
  /** "Why am I seeing this?" — targeting only (area / distance). */
  why: string;
}

export interface SponsoredBusiness {
  business: BusinessResponse;
  boostId: string;
  postId: string;
  why: string;
}

export type CreativeFormat = "SQUARE" | "STORY" | "OG";
export type PromoTemplateKey =
  | "OFFER_BOLD"
  | "MENU_HIGHLIGHT"
  | "MINIMAL"
  | "EVENT_POSTER"
  | "RATING_SHOWCASE"
  // V61
  | "CUSTOM"
  | "SPLIT_PHOTO"
  | "PRICE_SPOTLIGHT"
  | "FESTIVE"
  | "BIG_ANNOUNCEMENT"
  // V62 premium
  | "LUXE"
  | "MAGAZINE"
  | "GLASS"
  | "POLAROID";

/** V61: how an owner-uploaded banner sits in each format — whole image, or filling the frame (cropped). */
export type PromoImageFit = "FIT" | "FILL";

/** Mirrors promo.PromoRenderModel — facts are always read from the DB by the server. */
export interface PromoRenderModel {
  templateKey: PromoTemplateKey;
  businessName: string;
  logoUrl: string | null;
  areaName: string | null;
  cityName: string | null;
  averageRating: number | null;
  reviewCount: number;
  quote: { text: string; firstName: string; rating: number } | null;
  headline: string | null;
  subline: string | null;
  accentColor: string;
  photoUrl: string | null;
  showRating: boolean;
  showQr: boolean;
  showPrice: boolean;
  offer: { title: string; headlineText: string; originalPrice: number | null; offerPrice: number | null; validUntil: string; active: boolean } | null;
  menuItem: { name: string; price: number | null; priceText: string | null; photoUrl: string | null } | null;
  event: { title: string | null; start: string; end: string | null; location: string | null } | null;
  shareUrl: string;
  expired: boolean;
  /** V61: placement of the uploaded banner on the CUSTOM template. */
  imageFit?: PromoImageFit | null;
}

export interface CreativeData {
  headline: string | null;
  subline: string | null;
  accentColor: string | null;
  photoUrl: string | null;
  offerId: string | null;
  menuItemId: string | null;
  eventTitle: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  showRating: boolean;
  showQr: boolean;
  showPrice: boolean;
  imageFit?: PromoImageFit | null;
}

export interface CreativeView {
  id: string;
  businessId: string;
  templateKey: PromoTemplateKey;
  data: CreativeData;
  squareUrl: string | null;
  storyUrl: string | null;
  ogUrl: string | null;
  createdAt: string;
}

export interface SavedCreative {
  creative: CreativeView;
  uploads: { format: CreativeFormat; objectKey: string; putUrl: string }[];
}

export interface PromoTemplateInfo {
  key: PromoTemplateKey;
  name: string;
  supportedTypes: BusinessPostType[];
  formats: CreativeFormat[];
  configJson: string;
}

export interface StudioData {
  businessId: string;
  businessName: string;
  slug: string;
  logoUrl: string | null;
  areaName: string | null;
  cityName: string | null;
  categoryKind: string | null;
  averageRating: number | null;
  reviewCount: number;
  bestQuote: { text: string; firstName: string; rating: number } | null;
  photos: string[];
  offers: PromoOfferRef[];
  menuItems: PromoMenuItemRef[];
  templates: PromoTemplateInfo[];
  swatches: string[];
  logoColor: string | null;
  postsRemainingThisWeek: number;
  captionAiEnabled: boolean;
  boostsEnabled: boolean;
  /** V61: owners may upload their own banner/photos; `uploads` = recent ones, newest first. */
  uploadsEnabled: boolean;
  uploads: string[];
}

/** V61: pre-signed slot for an owner-uploaded promo image (always JPEG). */
export interface PromoUploadSlot {
  uploadUrl: string;
  objectKey: string;
  url: string;
}

export interface CaptionResult {
  bn: string[];
  en: string[];
  source: "AI" | "TEMPLATE";
  remainingToday: number;
}

export interface BusinessPostBody {
  type: BusinessPostType;
  title: string | null;
  body: string;
  creativeId: string | null;
  offerId: string | null;
  menuItemId: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  publish: boolean;
}

export type BoostStatus = "PENDING_PAYMENT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "ENDED" | "REJECTED" | "REFUNDED";

export interface BoostPackageInfo {
  id: string;
  name: string;
  priceBdt: number;
  estImpressions: number;
  durationDays: number;
  maxRadiusKm: number;
  active: boolean;
  sortOrder: number;
}

export interface PaymentOption {
  method: "BKASH" | "NAGAD";
  merchantNumber: string;
}

export interface BoostView {
  id: string;
  postId: string;
  businessId: string;
  businessName: string | null;
  packageName: string;
  status: BoostStatus;
  targetAreaIds: string[];
  targetAreaNames: string[];
  radiusKm: number | null;
  startAt: string;
  endAt: string;
  priceBdt: number;
  paymentMethod: "BKASH" | "NAGAD" | "MANUAL" | null;
  paymentRef: string | null;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  paidAmount: number | null;
  estImpressions: number;
  impressionsServed: number;
  rejectionReason: string | null;
  refundReason: string | null;
  createdAt: string;
  payment: { amount: number; currency: string; options: PaymentOption[]; note: string } | null;
}

export type PromoEventType =
  | "IMPRESSION" | "CLICK" | "PROFILE_VISIT" | "CALL" | "DIRECTIONS" | "MESSAGE" | "ORDER" | "BOOKING" | "OFFER_CLAIM" | "SHARE";
export type PromoSource = "FEED" | "HOME" | "SEARCH" | "SHARE_LINK" | "EXTERNAL";

export interface PromoDayPoint {
  day: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface PromoAnalytics {
  days: number;
  headline: { postId: string; title: string; views: number; clicks: number; conversions: number; conversionEvent: string } | null;
  totals: Record<PromoEventType, number>;
  daily: PromoDayPoint[];
  items: {
    postId: string;
    title: string;
    type: BusinessPostType;
    status: BusinessPostStatus;
    createdAt: string;
    totals: Record<PromoEventType, number>;
    daily: PromoDayPoint[];
    boosts: {
      boostId: string;
      status: BoostStatus;
      packageName: string;
      priceBdt: number;
      paidAmount: number | null;
      estImpressions: number;
      impressionsServed: number;
      startAt: string;
      endAt: string;
      costPerAction: number | null;
      actions: number;
    }[];
  }[];
  postsRemainingThisWeek: number;
}

export interface PromoSharePayload {
  post: CommunityPostResponse;
  business: BusinessResponse;
  creative: PromoRenderModel | null;
  shareUrl: string;
}

export interface CommunityCommentResponse {
  id: string;
  author: CommunityAuthorSummary;
  content: string;
  parentCommentId: string | null;
  depth: number;
  /** Only meaningful for a top-level (depth 0) comment on a QUESTION post. */
  isBestAnswer: boolean;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  myVote: CommunityPostVoteType | null;
  createdAt: string;
  updatedAt: string;
  status?: CommunityContentStatus;
  /** Only sent to the comment's own author when status === "REMOVED". */
  removedReason?: string | null;
  /** V58: the business replied as itself (only on its own posts). */
  business?: BusinessIdentity | null;
}

export interface CommunityTopicInfo {
  code: string;
  label: string;
  labelBn: string | null;
  /** lucide-react icon name. */
  icon: string | null;
  color: string | null;
  position: number;
  enabled: boolean;
  defaultTopic: boolean;
}

/** GET /api/v1/community/settings — admin-managed, public subset (mirrors the server rules for UX). */
export interface CommunityPublicSettings {
  communityEnabled: boolean;
  maintenanceMessage: string;
  readOnly: boolean;
  readOnlyMessage: string;
  guestsCanRead: boolean;
  topics: CommunityTopicInfo[];
  defaultTopic: string;
  postTypes: Record<CommunityPostType, boolean>;
  imagesEnabled: boolean;
  maxImagesPerPost: number;
  maxImageSizeMb: number;
  pollsEnabled: boolean;
  limits: {
    postBodyMin: number;
    postBodyMax: number;
    questionTitleMin: number;
    questionTitleMax: number;
    commentMin: number;
    commentMax: number;
    maxLinksPerPost: number;
  };
  allowedAreaIds: string[];
  rulesMarkdown: string;
  features: { nidVerificationEnabled: boolean };
  banner: { id: string; postId: string; text: string; scope: string; areaId: string | null; topic: string | null } | null;
}

export interface CommunityStandingItem {
  id: string;
  type: "WARN" | "MUTE" | "SUSPEND" | "BAN";
  reason: string;
  startsAt: string;
  endsAt: string | null;
}

/** GET /api/v1/community/me/standing — restricted = can't post/comment/vote right now. */
export interface CommunityStanding {
  restricted: boolean;
  restriction: CommunityStandingItem | null;
  items: CommunityStandingItem[];
}

export interface CommunityProfileResponse {
  /** Community-facing pseudonymous id — never the real account id. */
  communityProfileId: string;
  communityUsername: string;
  memberSince: string;
  verified: boolean;
  reviewCount: number;
  postCount: number;
  commentCount: number;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  communityAvatarUrl: string | null;
  /** V59: M/F badge — null when hidden or not chosen yet. */
  gender?: CommunityGender | null;
}

/** One row of a Following/Followers list. */
export interface CommunityFollowListItem {
  author: CommunityAuthorSummary;
  /** Whether the current viewer (not the list owner) already follows this person. */
  isFollowing: boolean;
}

export interface CreateCommunityPostBody {
  /** Not surfaced in the composer (single text box, no title field) — always null from the frontend. */
  title: string | null;
  body: string;
  postType: CommunityPostType;
  topic: CommunityTopic;
  businessId: string | null;
  areaId: string | null;
  /** Only sent when postType === "POLL": 2-6 option labels. */
  pollOptions: string[] | null;
  /** Only sent when postType === "POLL": hours, one of 24/72/168 (1/3/7 days). */
  pollDurationHours: number | null;
  /** CDN URLs from communityApi.requestUploadUrl, one call per file, after uploadFileToPresignedUrl succeeds. Up to 10. */
  imageUrls: string[];
}

export interface UpdateCommunityPostBody {
  title: string | null;
  body: string;
  topic: CommunityTopic;
  businessId: string | null;
  imageUrls: string[];
}

// ---------------------------------------------------------------------------
// Offers / Discounts — mirrors com.bdreview.platform.offer's response DTOs
// field-for-field. discountValue is only meaningful for the two numeric
// types (PERCENTAGE_DISCOUNT/FIXED_AMOUNT_DISCOUNT); originalPrice/offerPrice
// are both optional everywhere (not every offer type has a price to compare).
// ---------------------------------------------------------------------------
export type OfferType = "PERCENTAGE_DISCOUNT" | "FIXED_AMOUNT_DISCOUNT" | "BUY_ONE_GET_ONE" | "COMBO_DEAL" | "FREE_ITEM" | "OTHER";
export type OfferAvailability = "ONLINE" | "IN_STORE" | "BOTH";
/** EXPIRED is never the stored value from the frontend's point of view — see OfferResponse.effectiveStatus. */
export type OfferStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "REJECTED";
export type OfferClaimStatus = "CLAIMED" | "REDEEMED" | "EXPIRED" | "CANCELLED";

export interface OfferResponse {
  id: string;
  businessId: string;
  businessName: string | null;
  businessSlug: string | null;
  businessLogoUrl: string | null;
  businessVerified: boolean;
  businessAverageRating: number | null;
  businessReviewCount: number;
  areaName: string | null;
  cityName: string | null;
  title: string;
  offerType: OfferType;
  discountValue: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  description: string | null;
  termsAndConditions: string | null;
  imageUrl: string | null;
  /** Optional — the existing menu item this offer's discount applies to. Null = the offer stands alone. */
  menuItemId: string | null;
  /** Denormalized for display — null whenever menuItemId is null. */
  menuItemName: string | null;
  validFrom: string;
  validUntil: string;
  availability: OfferAvailability;
  /** The owner/admin-driven stored value. */
  status: OfferStatus;
  /** What the UI should actually show — EXPIRED overrides a stale ACTIVE once past validUntil. */
  effectiveStatus: OfferStatus;
  maxTotalRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  viewCount: number;
  claimCount: number;
  redemptionCount: number;
  rejectionReason: string | null;
  /** Whether the current viewer has saved this offer — false for an anonymous viewer. */
  saved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferClaimResponse {
  id: string;
  offerId: string;
  offerTitle: string | null;
  businessName: string | null;
  redemptionCode: string;
  status: OfferClaimStatus;
  claimedAt: string;
  redeemedAt: string | null;
}

export interface OfferAnalyticsResponse {
  views: number;
  claims: number;
  redemptions: number;
}

export interface CreateOfferBody {
  businessId: string;
  title: string;
  offerType: OfferType;
  discountValue?: number | null;
  originalPrice?: number | null;
  offerPrice?: number | null;
  description?: string | null;
  termsAndConditions?: string | null;
  imageUrl?: string | null;
  /** Optional — an existing menu item (same business) this offer's discount applies to. */
  menuItemId?: string | null;
  /** ISO instant */
  validFrom: string;
  /** ISO instant */
  validUntil: string;
  availability: OfferAvailability;
  maxTotalRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
}

/** Same field set as CreateOfferBody minus businessId, which never changes after creation. */
export type UpdateOfferBody = Omit<CreateOfferBody, "businessId">;