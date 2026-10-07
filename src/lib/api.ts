import { API_BASE_URL } from "./config";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
} from "./storage";
import type {
  PromoUploadSlot,
  CommunityGender,
  CommunityIdentityResponse,
  ApiError,
  AuditLog,
  AutoReply,
  AutoReplyBody,
  AvailabilityResponse,
  ReactionSummary,
  Booking,
  BookingStatus,
  Bookmark,
  BusinessAttribute,
  BusinessClaim,
  BusinessPhoto,
  MyModeratedPhoto,
  HomepageContent,
  PendingListingChange,
  VerificationRequestView,
  BusinessReactionType,
  BusinessResponse,
  BusinessSearchParams,
  SearchSuggestion,
  SmartSearchParams,
  SmartSearchResponse,
  AnalyticsRange,
  AnalyticsResponse,
  BusinessUpdate,
  BusinessUpdateBody,
  Category,
  City,
  Area,
  Collection,
  CommerceSettings,
  CommerceSettingsBody,
  CommunityCommentResponse,
  CommunityFeedTab,
  CommunityFollowListItem,
  CommunityMentionedBusinessSummary,
  HoursExceptionEntry,
  CommunityPollResponse,
  CommunityPostResponse,
  CommunityPostType,
  CommunityPostVoteType,
  CommunityProfileResponse,
  CommunityPublicSettings,
  CommunityQuestionRecommendation,
  CommunityStanding,
  CommunitySortOrder,
  CommunityTopic,
  CompletenessResponse,
  ConfirmUploadRequestT,
  CreateBusinessRequest,
  CreateCommunityPostBody,
  CreateOfferBody,
  DeliveryQuote,
  DeliveryZone,
  DeliveryZoneBody,
  Faq,
  FaqBody,
  FeaturedProduct,
  FeaturedProductBody,
  MenuItem,
  MenuItemBody,
  OfferAnalyticsResponse,
  OperatingHoursEntry,
  OfferAvailability,
  OfferClaimResponse,
  OfferResponse,
  Order,
  OrderStatus,
  PlaceBookingBody,
  PlaceOrderBody,
  PublicCommerceView,
  QrInfo,
  QrResolveResponse,
  ServiceOffering,
  ServiceOfferingBody,
  ServiceSection,
  StaffScheduleResponse,
  StaffServiceAssignment,
  TeamMember,
  TeamMemberBody,
  TimeOff,
  TimeOffBody,
  QueueStatus,
  WeeklyScheduleEntry,
  FakeReviewSignal,
  Message,
  MessageThread,
  ModerationQueueCounts,
  NotificationListResponse,
  PageResponse,
  PreferredLanguage,
  PreSignedUploadResponse,
  RatingBreakdown,
  RecentActivityItem,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  Review,
  ReviewResponse,
  ReviewSortOption,
  SubmitReviewRequest,
  TokenPairDto,
  UpdateBusinessRequest,
  UpdateCommunityPostBody,
  UpdateOfferBody,
  UpdateReviewRequest,
  UserProfile,
  UserRole,
  VerificationMethod,
  VisibilityStatus,
  VoteType,
} from "./types";
import type {
  BoostPackageInfo,
  BoostView,
  BusinessPostBody,
  CaptionResult,
  CreativeData,
  CreativeView,
  PaymentOption,
  PromoAnalytics,
  PromoRenderModel,
  PromoSharePayload,
  PromoTemplateKey,
  SavedCreative,
  SponsoredBusiness,
  StudioData,
  BusinessPostType,
  ChatReportReason,
  ContentPage,
  ContentSlug,
  SupportCategory,
  SupportTicketDetail,
  SupportTicketSummary,
} from "./types";
import { attributionQuery, promoSessionHeaders } from "./promo-session";

export class ApiClientError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, message: string, body: ApiError | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the stored refresh token for a fresh access/refresh pair and
 * persists it. Concurrent callers within this tab share one in-flight
 * request. Returns false (and leaves storage untouched) if there's no
 * refresh token or the server rejects it. Exported so the auth provider can
 * refresh proactively (on load and on a timer), not only reactively on 401.
 */
export async function tryRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const pair = (await res.json()) as TokenPairDto;
        setStoredTokens(pair.accessToken, pair.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function broadcastLoggedOut() {
  clearStoredTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rp:auth-invalid"));
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean; // default true — attach Authorization header if a token exists
  isRetry?: boolean;
  rawBody?: boolean; // send `body` as-is (already JSON.stringify'd) instead of re-stringifying
  headers?: Record<string, string>;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, isRetry = false, rawBody = false } = options;

  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getStoredAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : rawBody ? (body as string) : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, isRetry: true });
    }
    broadcastLoggedOut();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (payload as ApiError | null)?.message ||
      res.statusText ||
      (res.status === 401 || res.status === 403
        ? "Your session has expired or you don't have access — please log in again."
        : `Request failed (${res.status})`);
    throw new ApiClientError(res.status, message, payload as ApiError | null);
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Auth / OTP
// ---------------------------------------------------------------------------
export const authApi = {
  requestOtp: (phoneNumber: string) =>
    request<void>("/api/v1/otp/request", { method: "POST", body: { phoneNumber }, auth: false }),

  register: (phoneNumber: string, code: string, password: string, role: UserRole, name: string) =>
    request<TokenPairDto>("/api/v1/auth/register", {
      method: "POST",
      body: { phoneNumber, code, password, role, name },
      auth: false,
    }),

  // context omitted (or CONSUMER) logs into the personal account; pass
  // BUSINESS_OWNER to log into a linked business account instead — the two
  // are separate accounts (see lib/api.ts's ownerApi for the switch/link flow).
  login: (phoneNumber: string, password: string, context?: UserRole) =>
    request<TokenPairDto>("/api/v1/auth/login", {
      method: "POST",
      body: { phoneNumber, password, context: context ?? null },
      auth: false,
    }),

  resetPassword: (phoneNumber: string, code: string, newPassword: string, role: UserRole) =>
    request<TokenPairDto>("/api/v1/auth/reset-password", {
      method: "POST",
      body: { phoneNumber, code, newPassword, role },
      auth: false,
    }),

  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),

  // ---------------------------------------------------------------------
  // Two-account model: consumer + business are separate logins, optionally
  // linked for a frictionless switch (see components/navbar.tsx).
  // ---------------------------------------------------------------------

  /** Frictionless switch to the caller's linked counterpart account — no password re-entry. */
  switchAccount: () => request<TokenPairDto>("/api/v1/auth/switch-account", { method: "POST" }),

  /** Logged-in consumer account creates+links its business-account counterpart in one step. */
  registerBusiness: (password: string, name: string) =>
    request<TokenPairDto>("/api/v1/auth/register-business", {
      method: "POST",
      body: { password, name },
    }),

  /** Links the caller's account with an independently-registered opposite-role account under the same phone, via OTP proof. */
  linkAccounts: (code: string) =>
    request<void>("/api/v1/auth/link-accounts", { method: "POST", body: { code } }),
};

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------
export const userApi = {
  me: () => request<UserProfile>("/api/v1/users/me"),

  update: (name: string | null, preferredLanguage: PreferredLanguage, profilePhotoUrl: string | null) =>
    request<UserProfile>("/api/v1/users/me", {
      method: "PUT",
      body: { name, preferredLanguage, profilePhotoUrl },
    }),

  requestPhotoUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/users/me/photo/upload-url", {
      method: "POST",
      query: { filename },
    }),

  /** Separate upload path from requestPhotoUploadUrl above — the storage key never includes the real user id. */
  requestCommunityAvatarUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/users/me/community-avatar/upload-url", {
      method: "POST",
      query: { filename },
    }),

  updateCommunityAvatar: (communityAvatarUrl: string | null) =>
    request<UserProfile>("/api/v1/users/me/community-avatar", {
      method: "PUT",
      body: { communityAvatarUrl },
    }),
};

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export const referenceApi = {
  cities: () => request<City[]>("/api/v1/cities", { auth: false }),
  areas: (cityId: string) => request<Area[]>(`/api/v1/cities/${cityId}/areas`, { auth: false }),
  categories: () => request<Category[]>("/api/v1/categories", { auth: false }),
  attributes: () => request<BusinessAttribute[]>("/api/v1/attributes", { auth: false }),
};

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------
export const businessApi = {
  search: (params: BusinessSearchParams) =>
    request<PageResponse<BusinessResponse>>("/api/v1/businesses/search", {
      auth: false,
      query: { ...params },
    }),

  /** Intent-aware search behind the search box (Bangla/Banglish/English, typos, fallbacks). */
  smartSearch: (params: SmartSearchParams) =>
    request<SmartSearchResponse>("/api/v1/businesses/smart-search", {
      auth: false,
      query: { ...params },
      headers: promoSessionHeaders(),
    }),

  /** Dropdown rows for the search box — cheap, cacheable; call debounced. */
  searchSuggestions: (q: string, lang: "en" | "bn") =>
    request<SearchSuggestion[]>("/api/v1/businesses/search-suggestions", {
      auth: false,
      query: { q, lang },
    }),

  getBySlug: (slug: string) =>
    request<BusinessResponse>(`/api/v1/businesses/${encodeURIComponent(slug)}`, { auth: false }),

  /** Other locations of the same chain — see BusinessResponse.branchCount/brandSlug. */
  getBranches: (brandSlug: string) =>
    request<BusinessResponse[]>(`/api/v1/brands/${encodeURIComponent(brandSlug)}/branches`, { auth: false }),

  mine: () => request<BusinessResponse[]>("/api/v1/businesses/mine"),

  /** Free-text pre-check before "add a business" — e.g. "Biriyani House Mirpur" or just "KFC". */
  potentialDuplicates: (q: string) =>
    request<BusinessResponse[]>("/api/v1/businesses/potential-duplicates", {
      auth: false,
      query: { q },
    }),

  create: (body: CreateBusinessRequest) =>
    request<BusinessResponse>("/api/v1/businesses", { method: "POST", body }),

  update: (id: string, body: UpdateBusinessRequest) =>
    request<BusinessResponse>(`/api/v1/businesses/${id}`, { method: "PUT", body }),

  remove: (id: string) => request<void>(`/api/v1/businesses/${id}`, { method: "DELETE" }),

  /** Owner's next step after a flag (report workflow) — notifies every admin, doesn't clear the flag. */
  requestFlagReview: (id: string) =>
    request<void>(`/api/v1/businesses/${id}/flag/request-review`, { method: "POST" }),

  /** Toggles a direct reaction to the business as a whole (business-card reaction row). */
  react: (id: string, reactionType: BusinessReactionType) =>
    request<void>(`/api/v1/businesses/${id}/react`, { method: "POST", body: { reactionType } }),

  /** Full-replace of structured weekly hours (see OperatingHoursEntry) — powers the "open now" badge. */
  updateHours: (id: string, days: OperatingHoursEntry[]) =>
    request<OperatingHoursEntry[]>(`/api/v1/businesses/${id}/hours`, { method: "PUT", body: { days } }),

  /** Holiday / special-hours overrides — per-item CRUD (see HoursExceptionEntry), unlike updateHours' full-replace. */
  addHoursException: (id: string, body: Omit<HoursExceptionEntry, "id">) =>
    request<HoursExceptionEntry>(`/api/v1/businesses/${id}/hours-exceptions`, { method: "POST", body }),

  updateHoursException: (id: string, exceptionId: string, body: Omit<HoursExceptionEntry, "id">) =>
    request<HoursExceptionEntry>(`/api/v1/businesses/${id}/hours-exceptions/${exceptionId}`, { method: "PUT", body }),

  removeHoursException: (id: string, exceptionId: string) =>
    request<void>(`/api/v1/businesses/${id}/hours-exceptions/${exceptionId}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export const reviewApi = {
  /** Pre-signed direct-to-storage upload for a review photo — any authenticated user, not owner-gated (unlike galleryApi's). */
  requestUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/reviews/upload-url", {
      method: "POST",
      query: { filename },
    }),

  submit: (body: SubmitReviewRequest) =>
    request<ReviewResponse>("/api/v1/reviews", { method: "POST", body }),

  edit: (id: string, body: UpdateReviewRequest) =>
    request<ReviewResponse>(`/api/v1/reviews/${id}`, { method: "PUT", body }),

  remove: (id: string) => request<void>(`/api/v1/reviews/${id}`, { method: "DELETE" }),

  /** Public owner reply ("Response from the owner") — distinct from the private message thread. */
  reply: (id: string, reply: string) =>
    request<ReviewResponse>(`/api/v1/reviews/${id}/reply`, { method: "PUT", body: { reply } }),

  removeReply: (id: string) => request<ReviewResponse>(`/api/v1/reviews/${id}/reply`, { method: "DELETE" }),

  vote: (id: string, voteType: VoteType) =>
    request<void>(`/api/v1/reviews/${id}/vote`, { method: "POST", body: { voteType } }),

  listForBusiness: (businessId: string, page = 0, size = 20, sort: ReviewSortOption = "newest") =>
    request<PageResponse<ReviewResponse>>(`/api/v1/reviews/business/${businessId}`, {
      query: { page, size, sort },
    }),

  ownerDashboard: (
    businessId: string,
    page = 0,
    size = 20,
    filters?: { rating?: number | null; unrepliedOnly?: boolean; flaggedOnly?: boolean }
  ) =>
    request<PageResponse<ReviewResponse>>(`/api/v1/reviews/business/${businessId}/dashboard`, {
      query: {
        page,
        size,
        rating: filters?.rating ?? undefined,
        unrepliedOnly: filters?.unrepliedOnly || undefined,
        flaggedOnly: filters?.flaggedOnly || undefined,
      },
    }),

  ratingTrend: (businessId: string, bucket: "week" | "month" = "week") =>
    request<unknown[][]>(`/api/v1/reviews/business/${businessId}/rating-trend`, {
      query: { bucket },
    }),

  ratingBreakdown: (businessId: string) =>
    request<RatingBreakdown>(`/api/v1/reviews/business/${businessId}/rating-breakdown`, { auth: false }),

  mine: (page = 0, size = 20) =>
    request<PageResponse<ReviewResponse>>("/api/v1/reviews/mine", { query: { page, size } }),

  mineForBusiness: (businessId: string) =>
    request<ReviewResponse | null>(`/api/v1/reviews/business/${businessId}/mine`),

  recent: (page = 0, size = 9) =>
    request<PageResponse<RecentActivityItem>>("/api/v1/reviews/recent", { auth: false, query: { page, size } }),
};

// ---------------------------------------------------------------------------
// "Join Community" — Facebook-style feed: text/image posts, reactions,
// comments, business mentions. Feed/detail/comment reads are public
// (auth: false); everything else needs a logged-in user.
// ---------------------------------------------------------------------------
export interface CommunityFeedParams {
  tab?: CommunityFeedTab;
  topic?: CommunityTopic;
  postType?: CommunityPostType;
  sort?: CommunitySortOrder;
  areaId?: string;
  page?: number;
  size?: number;
  /** V58 sponsored targeting — only what the viewer chose to share. */
  viewerAreaId?: string;
  lat?: number;
  lng?: number;
}

export const communityApi = {
  /** Admin-managed community configuration (topics, post types, limits, rules, maintenance, feature flags). Public. */
  settings: () => request<CommunityPublicSettings>("/api/v1/community/settings", { auth: false }),

  /** The caller's own standing — active mute/suspend/ban and recent warnings. Empty for guests. */
  standing: () => request<CommunityStanding>("/api/v1/community/me/standing"),

  create: (body: CreateCommunityPostBody) =>
    request<CommunityPostResponse>("/api/v1/community/posts", { method: "POST", body }),

  /** Pre-signed direct-to-storage upload for a post's optional photo attachment — same flow as galleryApi.requestUploadUrl. */
  requestUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/community/posts/upload-url", {
      method: "POST",
      query: { filename },
    }),

  // No `auth: false` on these reads (unlike the old Facebook-feed implementation) — they're
  // still public/permitAll on the backend for a logged-out visitor, but a logged-in viewer's
  // token must go along so the server can resolve myVote and (for tab=FOLLOWING) who's asking.
  /**
   * The feed. The server may insert at most one "Sponsored" business post after every N organic
   * posts (never on Following or post-type tabs); `viewerAreaId`/`lat`/`lng` are only what the
   * viewer already chose to share, and the promo session header powers the per-viewer frequency cap.
   */
  feed: (params: CommunityFeedParams = {}) =>
    request<PageResponse<CommunityPostResponse>>("/api/v1/community/posts", {
      query: { page: 0, size: 20, ...params },
      headers: promoSessionHeaders(),
    }),

  get: (postId: string) => request<CommunityPostResponse>(`/api/v1/community/posts/${postId}`),

  postsByAuthor: (userId: string, page = 0, size = 20) =>
    request<PageResponse<CommunityPostResponse>>(`/api/v1/community/users/${userId}/posts`, {
      query: { page, size },
    }),

  commentsByAuthor: (userId: string, page = 0, size = 20) =>
    request<PageResponse<CommunityCommentResponse>>(`/api/v1/community/users/${userId}/comments`, {
      query: { page, size },
    }),

  update: (postId: string, body: UpdateCommunityPostBody) =>
    request<CommunityPostResponse>(`/api/v1/community/posts/${postId}`, { method: "PATCH", body }),

  remove: (postId: string) => request<void>(`/api/v1/community/posts/${postId}`, { method: "DELETE" }),

  vote: (postId: string, voteType: CommunityPostVoteType) =>
    request<void>(`/api/v1/community/posts/${postId}/votes`, {
      method: "POST",
      body: { voteType },
    }),

  voteComment: (postId: string, commentId: string, voteType: CommunityPostVoteType) =>
    request<void>(`/api/v1/community/posts/${postId}/comments/${commentId}/votes`, {
      method: "POST",
      body: { voteType },
    }),

  votePoll: (postId: string, optionId: string) =>
    request<CommunityPollResponse>(`/api/v1/community/posts/${postId}/poll/votes`, {
      method: "POST",
      body: { optionId },
    }),

  listComments: (postId: string, page = 0, size = 20) =>
    request<PageResponse<CommunityCommentResponse>>(`/api/v1/community/posts/${postId}/comments`, {
      query: { page, size },
    }),

  /** `asBusinessId`: reply as that business — only accepted on the business's own posts. */
  addComment: (postId: string, content: string, parentCommentId: string | null = null, asBusinessId: string | null = null) =>
    request<CommunityCommentResponse>(`/api/v1/community/posts/${postId}/comments`, {
      method: "POST",
      body: { content, parentCommentId, asBusinessId },
    }),

  removeComment: (postId: string, commentId: string) =>
    request<void>(`/api/v1/community/posts/${postId}/comments/${commentId}`, { method: "DELETE" }),

  markBestAnswer: (postId: string, commentId: string) =>
    request<CommunityCommentResponse>(`/api/v1/community/posts/${postId}/comments/${commentId}/best-answer`, { method: "POST" }),

  unmarkBestAnswer: (postId: string, commentId: string) =>
    request<CommunityCommentResponse>(`/api/v1/community/posts/${postId}/comments/${commentId}/best-answer`, { method: "DELETE" }),

  closeQuestion: (postId: string) => request<void>(`/api/v1/community/posts/${postId}/close`, { method: "POST" }),

  reopenQuestion: (postId: string) => request<void>(`/api/v1/community/posts/${postId}/reopen`, { method: "POST" }),

  /** "Questions for you" widget — personalized, so requires a logged-in viewer. */
  recommendedQuestions: () =>
    request<CommunityQuestionRecommendation[]>("/api/v1/community/questions/recommended"),

  followQuestion: (postId: string) =>
    request<void>(`/api/v1/community/posts/${postId}/follow-question`, { method: "POST" }),

  unfollowQuestion: (postId: string) =>
    request<void>(`/api/v1/community/posts/${postId}/follow-question`, { method: "DELETE" }),

  passQuestion: (postId: string) =>
    request<void>(`/api/v1/community/posts/${postId}/pass`, { method: "POST" }),

  searchMentions: (q: string) =>
    request<CommunityMentionedBusinessSummary[]>("/api/v1/community/mentions/search", {
      auth: false,
      query: { q },
    }),

  follow: (userId: string) => request<void>(`/api/v1/community/users/${userId}/follow`, { method: "POST" }),

  unfollow: (userId: string) => request<void>(`/api/v1/community/users/${userId}/follow`, { method: "DELETE" }),

  following: (userId: string, page = 0, size = 20) =>
    request<PageResponse<CommunityFollowListItem>>(`/api/v1/community/users/${userId}/following`, { query: { page, size } }),

  /** V60 Community search — live posts whose title/body contain every word. */
  searchPosts: (q: string, page = 0, size = 10) =>
    request<PageResponse<CommunityPostResponse>>("/api/v1/community/search/posts", { query: { q, page, size } }),
  /** V60 Community search — people by community username only (never real names). */
  searchPeople: (q: string, page = 0, size = 20) =>
    request<PageResponse<CommunityFollowListItem>>("/api/v1/community/search/people", { query: { q, page, size } }),

  followers: (userId: string, page = 0, size = 20) =>
    request<PageResponse<CommunityFollowListItem>>(`/api/v1/community/users/${userId}/followers`, { query: { page, size } }),

  checkUsername: (value: string) =>
    request<{ available: boolean }>("/api/v1/community/username/available", {
      auth: false,
      query: { value },
    }),

  suggestUsername: () => request<{ suggestion: string }>("/api/v1/community/username/suggestion"),

  /** V59: `gender` is required the first time; omit it on a rename to keep the current one. */
  setUsername: (username: string, gender?: CommunityGender | null) =>
    request<CommunityIdentityResponse>("/api/v1/community/username", {
      method: "POST",
      body: { username, gender: gender ?? null },
    }),
  /** V59: pick/change the M/F badge and/or show or hide it. */
  updateGender: (body: { gender?: CommunityGender; visible?: boolean }) =>
    request<CommunityIdentityResponse>("/api/v1/community/gender", { method: "PUT", body }),

  getProfile: (username: string) =>
    request<CommunityProfileResponse>(`/api/v1/community/profile/${encodeURIComponent(username)}`, { auth: false }),
};

// ---------------------------------------------------------------------------
// Business claim
// ---------------------------------------------------------------------------
export const claimApi = {
  requestPhone: (businessId: string) =>
    request<void>("/api/v1/claims/phone/request", { method: "POST", body: { businessId } }),

  verifyPhone: (businessId: string, code: string) =>
    request<BusinessClaim>("/api/v1/claims/phone/verify", { method: "POST", body: { businessId, code } }),

  requestEmail: (email: string) =>
    request<void>("/api/v1/claims/email/request", { method: "POST", body: { email } }),

  verifyEmail: (businessId: string, email: string, code: string) =>
    request<BusinessClaim>("/api/v1/claims/email/verify", { method: "POST", body: { businessId, email, code } }),

  documentUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/claims/document/upload-url", {
      method: "POST",
      query: { filename },
    }),

  fileDocument: (businessId: string, documentRef: string) =>
    request<BusinessClaim>("/api/v1/claims", {
      method: "POST",
      body: { businessId, verificationMethod: "DOCUMENT" as VerificationMethod, documentRef },
    }),

  documentBlobUrl: async (claimId: string): Promise<string> => {
    const token = getStoredAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/document`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new ApiClientError(res.status, "Failed to load document", null);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  mine: () => request<BusinessClaim[]>("/api/v1/claims/mine"),

  queue: (page = 0, size = 20) =>
    request<PageResponse<BusinessClaim>>("/api/v1/claims/queue", { query: { page, size } }),

  resolve: (id: string, approve: boolean, notes?: string) =>
    request<BusinessClaim>(`/api/v1/claims/${id}/resolve`, {
      method: "POST",
      body: { approve, notes: notes ?? null },
    }),
};

// ---------------------------------------------------------------------------
// Bookmarks / Collections
// ---------------------------------------------------------------------------
export const bookmarkApi = {
  add: (businessId: string, collectionId?: string | null) =>
    request<void>("/api/v1/bookmarks", { method: "POST", body: { businessId, collectionId: collectionId ?? null } }),

  remove: (businessId: string) => request<void>(`/api/v1/bookmarks/${businessId}`, { method: "DELETE" }),

  mine: () => request<Bookmark[]>("/api/v1/bookmarks"),

  createCollection: (name: string) =>
    request<Collection>("/api/v1/collections", { method: "POST", body: { name } }),

  renameCollection: (id: string, name: string) =>
    request<void>(`/api/v1/collections/${id}`, { method: "PUT", body: { name } }),

  deleteCollection: (id: string) => request<void>(`/api/v1/collections/${id}`, { method: "DELETE" }),

  myCollections: () => request<Collection[]>("/api/v1/collections"),

  collectionBookmarks: (id: string) => request<Bookmark[]>(`/api/v1/collections/${id}/bookmarks`),
};

// ---------------------------------------------------------------------------
// Offers / Discounts. Feed/detail/business-banner reads aren't `auth: false`
// (same reasoning as communityApi above) — they're public on the backend,
// but a logged-in viewer's token still needs to go along so the server can
// resolve the `saved` flag on each OfferResponse.
// ---------------------------------------------------------------------------
export interface OfferFeedParams {
  categoryId?: string;
  areaId?: string;
  availability?: OfferAvailability;
  endingSoon?: boolean;
  page?: number;
  size?: number;
}

export const offerApi = {
  feed: (params: OfferFeedParams = {}) =>
    request<PageResponse<OfferResponse>>("/api/v1/offers", { query: { page: 0, size: 20, ...params } }),

  get: (offerId: string) => request<OfferResponse>(`/api/v1/offers/${offerId}`),

  /** Business-profile banner — a business's own currently-active offers, no paging. */
  businessOffers: (businessId: string) => request<OfferResponse[]>(`/api/v1/offers/business/${businessId}`),

  /** Owner dashboard — every status, not just active. */
  businessOffersForOwner: (businessId: string, page = 0, size = 20) =>
    request<PageResponse<OfferResponse>>(`/api/v1/offers/business/${businessId}/mine`, { query: { page, size } }),

  create: (body: CreateOfferBody) => request<OfferResponse>("/api/v1/offers", { method: "POST", body }),

  update: (offerId: string, body: UpdateOfferBody) =>
    request<OfferResponse>(`/api/v1/offers/${offerId}`, { method: "PATCH", body }),

  submit: (offerId: string) => request<OfferResponse>(`/api/v1/offers/${offerId}/submit`, { method: "POST" }),

  cancel: (offerId: string) => request<void>(`/api/v1/offers/${offerId}`, { method: "DELETE" }),

  /** Carries promo attribution when the visitor arrived from a business post / share link (V58). */
  claim: (offerId: string, businessId?: string) =>
    request<OfferClaimResponse>(`/api/v1/offers/${offerId}/claim`, {
      method: "POST",
      query: attributionQuery({ offerId, businessId }),
    }),

  /** Business-owner/staff action — looks up a customer's claim by its redemption code. */
  redeem: (redemptionCode: string) =>
    request<OfferClaimResponse>("/api/v1/offers/redeem", { method: "POST", body: { redemptionCode } }),

  myClaims: (page = 0, size = 20) =>
    request<PageResponse<OfferClaimResponse>>("/api/v1/offers/claims/mine", { query: { page, size } }),

  save: (offerId: string) => request<void>(`/api/v1/offers/${offerId}/save`, { method: "POST" }),

  unsave: (offerId: string) => request<void>(`/api/v1/offers/${offerId}/save`, { method: "DELETE" }),

  mySavedOffers: (page = 0, size = 20) =>
    request<PageResponse<OfferResponse>>("/api/v1/offers/saved/mine", { query: { page, size } }),

  analytics: (offerId: string) => request<OfferAnalyticsResponse>(`/api/v1/offers/${offerId}/analytics`),

  adminQueue: (page = 0, size = 20) =>
    request<PageResponse<OfferResponse>>("/api/v1/offers/admin/queue", { query: { page, size } }),

  adminApprove: (offerId: string) => request<OfferResponse>(`/api/v1/offers/admin/${offerId}/approve`, { method: "POST" }),

  adminReject: (offerId: string, reason?: string) =>
    request<OfferResponse>(`/api/v1/offers/admin/${offerId}/reject`, { method: "POST", body: { reason: reason ?? null } }),

  adminRemove: (offerId: string) => request<void>(`/api/v1/offers/admin/${offerId}/remove`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const reportApi = {
  create: (targetType: ReportTargetType, targetId: string, reason: ReportReason) =>
    request<Report>("/api/v1/reports", { method: "POST", body: { targetType, targetId, reason } }),

  queue: (page = 0, size = 20) =>
    request<PageResponse<Report>>("/api/v1/reports/queue", { query: { page, size } }),

  resolve: (id: string, outcome: Exclude<ReportStatus, "PENDING">, resolutionNote?: string) =>
    request<void>(`/api/v1/reports/${id}/resolve`, {
      method: "POST",
      body: { outcome, resolutionNote: resolutionNote ?? null },
    }),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationApi = {
  list: (page = 0, size = 20) =>
    request<NotificationListResponse>("/api/v1/notifications", { query: { page, size } }),

  markRead: (id: string) => request<void>(`/api/v1/notifications/${id}/read`, { method: "PUT" }),

  markAllRead: () => request<void>("/api/v1/notifications/read-all", { method: "PUT" }),
};

// ---------------------------------------------------------------------------
// Moderation (admin)
// ---------------------------------------------------------------------------
export const moderationApi = {
  summary: () => request<ModerationQueueCounts>("/api/v1/admin/moderation/summary"),

  flaggedReviews: (page = 0, size = 20) =>
    request<PageResponse<Review>>("/api/v1/admin/moderation/flagged-reviews", { query: { page, size } }),

  resolveFlaggedReview: (reviewId: string, resolution: VisibilityStatus, notes?: string) =>
    request<void>(`/api/v1/admin/moderation/flagged-reviews/${reviewId}/resolve`, {
      method: "POST",
      query: { resolution, notes },
    }),

  auditLog: (entityType: string, entityId: string, page = 0, size = 20) =>
    request<PageResponse<AuditLog>>("/api/v1/admin/moderation/audit-log", {
      query: { entityType, entityId, page, size },
    }),
};

// ---------------------------------------------------------------------------
// Fake-review signals (admin)
// ---------------------------------------------------------------------------
export const fakeReviewApi = {
  signalsFor: (reviewId: string) =>
    request<FakeReviewSignal[]>(`/api/v1/admin/fake-review-signals/${reviewId}`),

  reAnalyze: (reviewId: string) =>
    request<void>(`/api/v1/admin/fake-review-signals/${reviewId}/re-analyze`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export const messageApi = {
  send: (businessId: string, content: string) =>
    request<Message>("/api/v1/messages", { method: "POST", body: { businessId, content } }),

  reply: (threadId: string, content: string) =>
    request<Message>(`/api/v1/messages/threads/${threadId}/reply`, { method: "POST", body: { content } }),

  /** Posts an auto-reply's configured answer as if from the owner — content is looked up
   *  server-side by id, never sent from here (see components/chat/use-message-thread.ts). */
  triggerAutoReply: (threadId: string, autoReplyId: string) =>
    request<Message>(`/api/v1/messages/threads/${threadId}/auto-reply`, { method: "POST", body: { autoReplyId } }),

  /** Tapping the same emoji again removes it; a different one replaces it — returns the message's updated reaction list. */
  react: (messageId: string, emoji: string) =>
    request<ReactionSummary[]>(`/api/v1/messages/${messageId}/reactions`, { method: "POST", body: { emoji } }),

  markRead: (threadId: string) =>
    request<void>(`/api/v1/messages/threads/${threadId}/read`, { method: "POST" }),

  history: (threadId: string, page = 0, size = 50) =>
    request<PageResponse<Message>>(`/api/v1/messages/threads/${threadId}`, { query: { page, size } }),

  myThreads: () => request<MessageThread[]>("/api/v1/messages/threads/mine"),

  businessInbox: () => request<MessageThread[]>("/api/v1/messages/threads/business-inbox"),

  /** Report a conversation (chat ⋯ menu). Only reported conversations ever reach Jachai's moderators. */
  reportThread: (threadId: string, reason: ChatReportReason, details?: string) =>
    request<{ id: string; status: string }>(`/api/v1/messages/threads/${threadId}/report`, {
      method: "POST",
      body: { reason, details },
    }),

  /** False while a messaging block (after a reported conversation) is active. */
  canSend: () => request<{ canSend: boolean; blockedUntil: string | null }>("/api/v1/messages/can-send"),
};

// ---------------------------------------------------------------------------
// Help → Contact support (V67)
// ---------------------------------------------------------------------------
export const supportApi = {
  /** Screenshot upload — stored privately (only you and Jachai staff can open it). */
  requestUploadUrl: (filename: string) =>
    request<PreSignedUploadResponse>("/api/v1/support/tickets/upload-url", { method: "POST", query: { filename } }),
  open: (body: { category: SupportCategory; subject: string; message: string; screenshotUrl?: string }) =>
    request<SupportTicketDetail>("/api/v1/support/tickets", { method: "POST", body }),
  mine: () => request<SupportTicketSummary[]>("/api/v1/support/tickets"),
  get: (id: string) => request<SupportTicketDetail>(`/api/v1/support/tickets/${id}`),
  reply: (id: string, message: string) =>
    request<SupportTicketDetail>(`/api/v1/support/tickets/${id}/messages`, { method: "POST", body: { message } }),
};

// ---------------------------------------------------------------------------
// Content pages — Terms, Privacy, FAQ, Help (V67)
// ---------------------------------------------------------------------------
export const contentApi = {
  get: (slug: ContentSlug, lang: "en" | "bn") =>
    request<ContentPage>(`/api/v1/content/${slug}`, { query: { lang }, auth: false }),
};

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
/** Curated homepage content (admin → System → Homepage). */
export const homeApi = {
  get: () => request<HomepageContent>("/api/v1/home", { auth: false }),
};

/** Listing integrity (owner side): the Verified badge request and protected edits awaiting approval. */
export const listingApi = {
  /** null when nothing is waiting (the API answers 204). */
  pendingChange: (businessId: string) =>
    request<PendingListingChange | undefined>(`/api/v1/businesses/${businessId}/pending-changes`).then((r) => r ?? null),
  verificationHistory: (businessId: string) =>
    request<VerificationRequestView[]>(`/api/v1/businesses/${businessId}/verification-requests`),
  requestVerification: (businessId: string, body: { method: "PHONE" | "DOCUMENT"; note?: string; documentRef?: string }) =>
    request<VerificationRequestView>(`/api/v1/businesses/${businessId}/verification-requests`, { method: "POST", body }),
  cancelVerification: (businessId: string, requestId: string) =>
    request<VerificationRequestView>(`/api/v1/businesses/${businessId}/verification-requests/${requestId}`, { method: "DELETE" }),
  /** The owner withdraws a protected edit that is still waiting for review. */
  cancelPendingChange: (businessId: string, changeId: string) =>
    request<void>(`/api/v1/businesses/${businessId}/pending-changes/${changeId}`, { method: "DELETE" }),
};

/** Photo moderation — the caller's own pending/rejected uploads (any source). */
export const photosApi = {
  mine: () => request<MyModeratedPhoto[]>("/api/v1/photos/mine"),
};

export const galleryApi = {
  requestUploadUrl: (businessId: string, filename: string) =>
    request<PreSignedUploadResponse>(`/api/v1/businesses/${businessId}/photos/upload-url`, {
      method: "POST",
      query: { filename },
    }),

  confirm: (businessId: string, cdnUrl: string) =>
    request<BusinessPhoto>(`/api/v1/businesses/${businessId}/photos/confirm`, {
      method: "POST",
      body: { businessId, cdnUrl } satisfies ConfirmUploadRequestT,
    }),

  remove: (businessId: string, photoId: string) =>
    request<void>(`/api/v1/businesses/${businessId}/photos/${photoId}`, { method: "DELETE" }),

  /** Persist a new gallery order — `orderedPhotoIds` must list every current photo id exactly once. */
  reorder: (businessId: string, orderedPhotoIds: string[]) =>
    request<BusinessPhoto[]>(`/api/v1/businesses/${businessId}/photos/reorder`, {
      method: "PATCH",
      body: { orderedPhotoIds },
    }),

  list: (businessId: string) =>
    request<BusinessPhoto[]>(`/api/v1/businesses/${businessId}/photos`, { auth: false }),
};

// ---------------------------------------------------------------------------
// Phase 2 — category showcase modules (services / team / menu / products).
// GET is public; writes are owner-scoped. Each list is fetched on demand
// (never bundled into GET /businesses/{slug}).
// ---------------------------------------------------------------------------
export const catalogApi = {
  // Services — also gym membership (section OFFERING) and gym facilities (section FACILITY).
  services: (businessId: string, section?: ServiceSection) =>
    request<ServiceOffering[]>(`/api/v1/businesses/${businessId}/services`, { auth: false, query: { section } }),
  addService: (businessId: string, body: ServiceOfferingBody) =>
    request<ServiceOffering>(`/api/v1/businesses/${businessId}/services`, { method: "POST", body }),
  updateService: (businessId: string, id: string, body: ServiceOfferingBody) =>
    request<ServiceOffering>(`/api/v1/businesses/${businessId}/services/${id}`, { method: "PUT", body }),
  removeService: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/services/${id}`, { method: "DELETE" }),
  reorderServices: (businessId: string, orderedIds: string[], section?: ServiceSection) =>
    request<ServiceOffering[]>(`/api/v1/businesses/${businessId}/services/reorder`, {
      method: "PATCH",
      body: { orderedIds },
      query: { section },
    }),

  // Team — doctors / staff / trainers.
  team: (businessId: string) =>
    request<TeamMember[]>(`/api/v1/businesses/${businessId}/team`, { auth: false }),
  addTeamMember: (businessId: string, body: TeamMemberBody) =>
    request<TeamMember>(`/api/v1/businesses/${businessId}/team`, { method: "POST", body }),
  updateTeamMember: (businessId: string, id: string, body: TeamMemberBody) =>
    request<TeamMember>(`/api/v1/businesses/${businessId}/team/${id}`, { method: "PUT", body }),
  removeTeamMember: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/team/${id}`, { method: "DELETE" }),
  reorderTeam: (businessId: string, orderedIds: string[]) =>
    request<TeamMember[]>(`/api/v1/businesses/${businessId}/team/reorder`, { method: "PATCH", body: { orderedIds } }),

  // Staff scheduling (booking — Salon & Beauty).
  staffForService: (businessId: string, serviceId: string) =>
    request<TeamMember[]>(`/api/v1/businesses/${businessId}/services/${serviceId}/staff`, { auth: false }),
  staffSchedule: (businessId: string, staffId: string) =>
    request<StaffScheduleResponse>(`/api/v1/businesses/${businessId}/team/${staffId}/schedule`),
  updateStaffSchedule: (businessId: string, staffId: string, days: WeeklyScheduleEntry[]) =>
    request<WeeklyScheduleEntry[]>(`/api/v1/businesses/${businessId}/team/${staffId}/schedule`, {
      method: "PUT",
      body: { days },
    }),
  updateStaffServices: (businessId: string, staffId: string, assignments: StaffServiceAssignment[]) =>
    request<StaffServiceAssignment[]>(`/api/v1/businesses/${businessId}/team/${staffId}/services`, {
      method: "PUT",
      body: { assignments },
    }),
  addStaffTimeOff: (businessId: string, staffId: string, body: TimeOffBody) =>
    request<TimeOff>(`/api/v1/businesses/${businessId}/team/${staffId}/time-off`, { method: "POST", body }),
  removeStaffTimeOff: (businessId: string, staffId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/team/${staffId}/time-off/${id}`, { method: "DELETE" }),

  // Menu — restaurant.
  menuItems: (businessId: string) =>
    request<MenuItem[]>(`/api/v1/businesses/${businessId}/menu-items`, { auth: false }),
  addMenuItem: (businessId: string, body: MenuItemBody) =>
    request<MenuItem>(`/api/v1/businesses/${businessId}/menu-items`, { method: "POST", body }),
  updateMenuItem: (businessId: string, id: string, body: MenuItemBody) =>
    request<MenuItem>(`/api/v1/businesses/${businessId}/menu-items/${id}`, { method: "PUT", body }),
  removeMenuItem: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/menu-items/${id}`, { method: "DELETE" }),
  reorderMenuItems: (businessId: string, orderedIds: string[]) =>
    request<MenuItem[]>(`/api/v1/businesses/${businessId}/menu-items/reorder`, { method: "PATCH", body: { orderedIds } }),

  // Featured products — retail.
  products: (businessId: string) =>
    request<FeaturedProduct[]>(`/api/v1/businesses/${businessId}/products`, { auth: false }),
  addProduct: (businessId: string, body: FeaturedProductBody) =>
    request<FeaturedProduct>(`/api/v1/businesses/${businessId}/products`, { method: "POST", body }),
  updateProduct: (businessId: string, id: string, body: FeaturedProductBody) =>
    request<FeaturedProduct>(`/api/v1/businesses/${businessId}/products/${id}`, { method: "PUT", body }),
  removeProduct: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/products/${id}`, { method: "DELETE" }),
  reorderProducts: (businessId: string, orderedIds: string[]) =>
    request<FeaturedProduct[]>(`/api/v1/businesses/${businessId}/products/reorder`, { method: "PATCH", body: { orderedIds } }),

  faqs: (businessId: string) =>
    request<Faq[]>(`/api/v1/businesses/${businessId}/faqs`, { auth: false }),
  addFaq: (businessId: string, body: FaqBody) =>
    request<Faq>(`/api/v1/businesses/${businessId}/faqs`, { method: "POST", body }),
  updateFaq: (businessId: string, id: string, body: FaqBody) =>
    request<Faq>(`/api/v1/businesses/${businessId}/faqs/${id}`, { method: "PUT", body }),
  removeFaq: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/faqs/${id}`, { method: "DELETE" }),
  reorderFaqs: (businessId: string, orderedIds: string[]) =>
    request<Faq[]>(`/api/v1/businesses/${businessId}/faqs/reorder`, { method: "PATCH", body: { orderedIds } }),
};

// ---------------------------------------------------------------------------
// Quick-reply auto-answers — chat widget shortcuts (see components/chat)
// ---------------------------------------------------------------------------
export const autoReplyApi = {
  list: (businessId: string) =>
    request<AutoReply[]>(`/api/v1/businesses/${businessId}/auto-replies`, { auth: false }),
  create: (businessId: string, body: AutoReplyBody) =>
    request<AutoReply>(`/api/v1/businesses/${businessId}/auto-replies`, { method: "POST", body }),
  update: (businessId: string, id: string, body: AutoReplyBody) =>
    request<AutoReply>(`/api/v1/businesses/${businessId}/auto-replies/${id}`, { method: "PUT", body }),
  remove: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/auto-replies/${id}`, { method: "DELETE" }),
  reorder: (businessId: string, orderedIds: string[]) =>
    request<AutoReply[]>(`/api/v1/businesses/${businessId}/auto-replies/reorder`, { method: "PATCH", body: { orderedIds } }),
};

// ---------------------------------------------------------------------------
// Commerce & Fulfillment (Phase A) — commerce settings + delivery zones.
// GET /commerce and GET /delivery-zones are public; writes + the checkout
// quote require auth. The business fulfils orders itself — no rider fleet.
// ---------------------------------------------------------------------------
export const commerceApi = {
  /** Public-safe commerce view — used by the menu tab + checkout. */
  publicSettings: (businessId: string) =>
    request<PublicCommerceView>(`/api/v1/businesses/${businessId}/commerce`, { auth: false }),
  ownerSettings: (businessId: string) =>
    request<CommerceSettings>(`/api/v1/businesses/${businessId}/commerce/manage`),
  updateSettings: (businessId: string, body: CommerceSettingsBody) =>
    request<CommerceSettings>(`/api/v1/businesses/${businessId}/commerce`, { method: "PUT", body }),
  setAccepting: (businessId: string, accepting: boolean, reason?: string) =>
    request<CommerceSettings>(`/api/v1/businesses/${businessId}/commerce/accepting`, {
      method: "PUT",
      body: { accepting, reason: reason ?? null },
    }),

  zones: (businessId: string) =>
    request<DeliveryZone[]>(`/api/v1/businesses/${businessId}/delivery-zones`, { auth: false }),
  addZone: (businessId: string, body: DeliveryZoneBody) =>
    request<DeliveryZone>(`/api/v1/businesses/${businessId}/delivery-zones`, { method: "POST", body }),
  updateZone: (businessId: string, id: string, body: DeliveryZoneBody) =>
    request<DeliveryZone>(`/api/v1/businesses/${businessId}/delivery-zones/${id}`, { method: "PUT", body }),
  removeZone: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/delivery-zones/${id}`, { method: "DELETE" }),
  reorderZones: (businessId: string, orderedIds: string[]) =>
    request<DeliveryZone[]>(`/api/v1/businesses/${businessId}/delivery-zones/reorder`, {
      method: "PATCH",
      body: { orderedIds },
    }),

  /** Checkout distance/fee preview for a candidate delivery location (authed). */
  deliveryQuote: (businessId: string, lat: number, lng: number) =>
    request<DeliveryQuote>(`/api/v1/businesses/${businessId}/delivery-quote`, {
      method: "POST",
      body: { lat, lng },
    }),

  /** Phase C — owner on/off switch for online booking (Salon & Beauty). */
  setBooking: (businessId: string, bookingEnabled: boolean, autoConfirmBookings: boolean) =>
    request<CommerceSettings>(`/api/v1/businesses/${businessId}/commerce/booking`, {
      method: "PUT",
      body: { bookingEnabled, autoConfirmBookings },
    }),
};

export const orderApi = {
  place: (businessId: string, body: PlaceOrderBody) =>
    request<Order>(`/api/v1/businesses/${businessId}/orders`, { method: "POST", body, query: attributionQuery({ businessId }) }),
  mine: (page = 0, size = 20) =>
    request<PageResponse<Order>>("/api/v1/orders/mine", { query: { page, size } }),
  get: (id: string) => request<Order>(`/api/v1/orders/${id}`),
  cancel: (id: string) => request<Order>(`/api/v1/orders/${id}/cancel`, { method: "POST" }),

  ownerList: (businessId: string, status?: OrderStatus, page = 0, size = 20) =>
    request<PageResponse<Order>>(`/api/v1/businesses/${businessId}/orders`, {
      query: { status, page, size },
    }),
  pendingCount: (businessId: string) =>
    request<number>(`/api/v1/businesses/${businessId}/orders/pending-count`),
  setStatus: (id: string, status: OrderStatus, note?: string) =>
    request<Order>(`/api/v1/orders/${id}/status`, { method: "PATCH", body: { status, note: note ?? null } }),
};

// ---------------------------------------------------------------------------
// Commerce & Fulfillment (Phase C) — appointment booking (Salon & Beauty).
// Stage 1: a real availability engine generates slots from staff schedules;
// the backend re-checks at placement — the frontend's availability view is
// only advisory. Mirrors orderApi's shape.
// ---------------------------------------------------------------------------
export const bookingApi = {
  place: (businessId: string, body: PlaceBookingBody) =>
    request<Booking>(`/api/v1/businesses/${businessId}/bookings`, { method: "POST", body, query: attributionQuery({ businessId }) }),
  /** Public — staffId omitted means "any available staff". */
  availability: (businessId: string, serviceId: string, staffId: string | null, date: string) =>
    request<AvailabilityResponse>(`/api/v1/businesses/${businessId}/bookings/availability`, {
      auth: false,
      query: { serviceId, staffId: staffId ?? undefined, date },
    }),
  mine: (page = 0, size = 20) =>
    request<PageResponse<Booking>>("/api/v1/bookings/mine", { query: { page, size } }),
  get: (id: string) => request<Booking>(`/api/v1/bookings/${id}`),
  cancel: (id: string) => request<Booking>(`/api/v1/bookings/${id}/cancel`, { method: "POST" }),
  /** Live queue position/ETA — customer or owner; `applicable: false` for anything not CONFIRMED-today. */
  queueStatus: (id: string) => request<QueueStatus>(`/api/v1/bookings/${id}/queue-status`),

  ownerList: (businessId: string, status?: BookingStatus, page = 0, size = 20) =>
    request<PageResponse<Booking>>(`/api/v1/businesses/${businessId}/bookings`, {
      query: { status, page, size },
    }),
  pendingCount: (businessId: string) =>
    request<number>(`/api/v1/businesses/${businessId}/bookings/pending-count`),
  setStatus: (id: string, status: BookingStatus, note?: string) =>
    request<Booking>(`/api/v1/bookings/${id}/status`, { method: "PATCH", body: { status, note: note ?? null } }),
  /** Owner marks a CONFIRMED booking as actually under way — not a status change. */
  start: (id: string) => request<Booking>(`/api/v1/bookings/${id}/start`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Phase 3 — business updates (owner CRUD + public list)
// ---------------------------------------------------------------------------
export const updatesApi = {
  publicList: (businessId: string, page = 0, size = 10) =>
    request<PageResponse<BusinessUpdate>>(`/api/v1/businesses/${businessId}/updates`, {
      auth: false,
      query: { page, size },
    }),
  manageList: (businessId: string, page = 0, size = 20) =>
    request<PageResponse<BusinessUpdate>>(`/api/v1/businesses/${businessId}/updates/manage`, { query: { page, size } }),
  create: (businessId: string, body: BusinessUpdateBody) =>
    request<BusinessUpdate>(`/api/v1/businesses/${businessId}/updates`, { method: "POST", body }),
  update: (businessId: string, id: string, body: BusinessUpdateBody) =>
    request<BusinessUpdate>(`/api/v1/businesses/${businessId}/updates/${id}`, { method: "PUT", body }),
  setPublished: (businessId: string, id: string, published: boolean) =>
    request<BusinessUpdate>(`/api/v1/businesses/${businessId}/updates/${id}/publish`, {
      method: "PATCH",
      body: { published },
    }),
  remove: (businessId: string, id: string) =>
    request<void>(`/api/v1/businesses/${businessId}/updates/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Phase 3 — analytics (owner/admin read; the write path is lib/analytics.ts sendBeacon)
// ---------------------------------------------------------------------------
export const analyticsApi = {
  get: (businessId: string, range: AnalyticsRange = "30d") =>
    request<AnalyticsResponse>(`/api/v1/businesses/${businessId}/analytics`, { query: { range } }),
};

// ---------------------------------------------------------------------------
// Business QR V1
// ---------------------------------------------------------------------------
export const qrApi = {
  /** Owner-only, idempotent — first call creates the permanent QR, later calls return the same one. */
  mine: (businessId: string) => request<QrInfo>(`/api/v1/businesses/${businessId}/qr`),
  /** Public — resolves a scanned token to the business's current slug. */
  resolve: (token: string) => request<QrResolveResponse>(`/api/v1/qr/${token}`, { auth: false }),
};

// ---------------------------------------------------------------------------
// Phase 3 — profile completeness (owner/admin)
// ---------------------------------------------------------------------------
export const completenessApi = {
  get: (businessId: string) =>
    request<CompletenessResponse>(`/api/v1/businesses/${businessId}/completeness`),
};

/**
 * Direct-to-storage upload for the pre-signed URL flow (spec §13). In
 * local/dev deployments the URL points at the backend's own local-disk
 * StorageController; swap ObjectStorageClient for a real S3/R2 client
 * server-side to point this at a real bucket in prod.
 */
export async function uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<boolean> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}
// ---------------------------------------------------------------------------
// Business promotion (V58)
// ---------------------------------------------------------------------------
export interface CreativeRequestBody {
  templateKey: PromoTemplateKey;
  data: CreativeData;
}

export interface CaptionRequestBody {
  type: BusinessPostType;
  offerId?: string | null;
  menuItemId?: string | null;
  eventTitle?: string | null;
  eventStart?: string | null;
  tone?: "friendly" | "premium" | "urgent";
}

export const promoApi = {
  // ---- Design Studio (owner) ----
  studio: (businessId: string) => request<StudioData>(`/api/v1/promo/businesses/${businessId}/studio`),
  /** V61: a pre-signed slot for the owner's own banner/photo. */
  uploadSlot: (businessId: string) =>
    request<PromoUploadSlot>(`/api/v1/promo/businesses/${businessId}/uploads`, { method: "POST" }),
  previewModel: (businessId: string, body: CreativeRequestBody) =>
    request<PromoRenderModel>(`/api/v1/promo/businesses/${businessId}/render-model`, { method: "POST", body }),
  saveCreative: (businessId: string, body: CreativeRequestBody) =>
    request<SavedCreative>(`/api/v1/promo/businesses/${businessId}/creatives`, { method: "POST", body }),
  updateCreative: (creativeId: string, body: CreativeRequestBody) =>
    request<SavedCreative>(`/api/v1/promo/creatives/${creativeId}`, { method: "PUT", body }),
  markRendered: (creativeId: string, keys: { squareKey: string; storyKey: string; ogKey: string }) =>
    request<CreativeView>(`/api/v1/promo/creatives/${creativeId}/rendered`, { method: "POST", body: keys }),
  captions: (businessId: string, body: CaptionRequestBody) =>
    request<CaptionResult>(`/api/v1/promo/businesses/${businessId}/captions`, { method: "POST", body }),

  // ---- Business posts ----
  createPost: (businessId: string, body: BusinessPostBody) =>
    request<CommunityPostResponse>(`/api/v1/promo/businesses/${businessId}/posts`, { method: "POST", body }),
  updatePost: (postId: string, body: BusinessPostBody) =>
    request<CommunityPostResponse>(`/api/v1/promo/posts/${postId}`, { method: "PUT", body }),
  publishPost: (postId: string) => request<CommunityPostResponse>(`/api/v1/promo/posts/${postId}/publish`, { method: "POST" }),
  deletePost: (postId: string) => request<void>(`/api/v1/promo/posts/${postId}`, { method: "DELETE" }),
  myPosts: (businessId: string) => request<CommunityPostResponse[]>(`/api/v1/promo/businesses/${businessId}/posts`),
  interested: (postId: string) =>
    request<{ interestedCount: number }>(`/api/v1/promo/posts/${postId}/interested`, { method: "POST" }),

  // ---- Boost ----
  packages: () =>
    request<{ packages: BoostPackageInfo[]; paymentOptions: PaymentOption[]; boostsEnabled: boolean }>("/api/v1/promo/boost-packages"),
  createBoost: (postId: string, body: { packageId: string; targetAreaIds: string[] | null; radiusKm: number | null; startDate: string }) =>
    request<BoostView>(`/api/v1/promo/posts/${postId}/boosts`, { method: "POST", body }),
  pay: (boostId: string, body: { method: "BKASH" | "NAGAD"; transactionId: string }) =>
    request<BoostView>(`/api/v1/promo/boosts/${boostId}/payment`, { method: "POST", body }),
  pauseBoost: (boostId: string) => request<BoostView>(`/api/v1/promo/boosts/${boostId}/pause`, { method: "POST" }),
  resumeBoost: (boostId: string) => request<BoostView>(`/api/v1/promo/boosts/${boostId}/resume`, { method: "POST" }),
  boosts: (businessId: string) => request<BoostView[]>(`/api/v1/promo/businesses/${businessId}/boosts`),

  // ---- Analytics ----
  analytics: (businessId: string, days = 30) =>
    request<PromoAnalytics>(`/api/v1/promo/businesses/${businessId}/analytics`, { query: { days } }),

  // ---- Public ----
  share: (postId: string) => request<PromoSharePayload>(`/api/v1/promo/public/posts/${postId}/share`, { auth: false }),
  featuredNearby: (params: { areaId?: string; lat?: number; lng?: number }) =>
    request<SponsoredBusiness[]>("/api/v1/promo/public/featured-nearby", { auth: false, query: { ...params }, headers: promoSessionHeaders() }),
};
