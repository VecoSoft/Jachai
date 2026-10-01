/* eslint-disable @next/next/no-img-element */
/**
 * Design Studio creative templates (V58). ONE component tree renders both:
 *   - the live HTML preview in the Studio (scaled with a CSS transform) — native browser text, and
 *   - the PNG outputs on the server (src/lib/promo-render.tsx, Satori + resvg) — where every text
 *     run is shaped by HarfBuzz (src/lib/promo-shaper.ts) so Bangla conjuncts and vowel signs
 *     ("ক্ষ", "ন্ত", "শুক্রবার", "বিরিয়ানি") render correctly; Satori alone can't reorder Indic text.
 * So everything here is Satori-safe: inline styles only, flexbox only (every element with more than
 * one child is display:flex), no hooks, <img> for pictures. Every text run goes through tx() with an
 * explicit width box, so wrapping and clamping match between the preview and the PNG.
 *
 * Facts (prices, offer text, validity, rating, review quote) come from PromoRenderModel, which the
 * server builds from the database — templates never invent or edit them. Creatives always draw on
 * their own light/brand backgrounds, whatever the site's dark mode.
 */
import type { CSSProperties, ReactNode } from "react";
import type { CreativeFormat, PromoRenderModel, PromoTemplateKey } from "@/lib/types";

export const FORMAT_SIZE: Record<CreativeFormat, { width: number; height: number }> = {
  SQUARE: { width: 1080, height: 1080 },
  STORY: { width: 1080, height: 1920 },
  OG: { width: 1200, height: 630 },
};

export const TEMPLATE_KEYS: PromoTemplateKey[] = [
  "OFFER_BOLD",
  "MENU_HIGHLIGHT",
  "MINIMAL",
  "EVENT_POSTER",
  "RATING_SHOWCASE",
  "CUSTOM",
  "SPLIT_PHOTO",
  "PRICE_SPOTLIGHT",
  "FESTIVE",
  "BIG_ANNOUNCEMENT",
  "LUXE",
  "MAGAZINE",
  "GLASS",
  "POLAROID",
];

export const PROMO_FONT_FAMILY = "Hind Siliguri";
const BRAND_RED = "#C8102E";
const INK = "#111827";
const MUTED = "#4B5563";
const GOLD = "#F5C542";

// ---------------------------------------------------------------------------
// Text shaping contract (implemented server-side by src/lib/promo-shaper.ts)
// ---------------------------------------------------------------------------

export interface ShapeOpts {
  size: number;
  weight?: 400 | 600 | 700;
  color: string;
  maxWidth: number;
  lines?: number;
  lineHeight?: number;
  align?: "left" | "center" | "right";
  strike?: boolean;
  opacity?: number;
}

export interface Shaped {
  src: string;
  width: number;
  height: number;
}

export type Shaper = (text: string, o: ShapeOpts) => Shaped | null;

const BENGALI = /[ঀ-৿]/;

/** Creative language follows the owner's own words: Bangla headline/subline → Bangla labels. */
export function creativeLang(m: Pick<PromoRenderModel, "headline" | "subline" | "event">): "bn" | "en" {
  return BENGALI.test(`${m.headline ?? ""}${m.subline ?? ""}${m.event?.title ?? ""}`) ? "bn" : "en";
}

const LABELS = {
  en: {
    validUntil: (d: string) => `Valid until ${d}`,
    orderOn: "Order on Jachai",
    interested: "Interested? Tap on Jachai",
    reviews: (r: string, n: number) => `${r} from ${n} review${n === 1 ? "" : "s"} on Jachai`,
    newOn: "New on Jachai",
    scan: "Scan to visit",
    expired: "EXPIRED",
    uploadHint: "Upload your banner",
  },
  bn: {
    validUntil: (d: string) => `${d} পর্যন্ত`,
    orderOn: "Jachai-তে অর্ডার করুন",
    interested: "আগ্রহী? Jachai-তে জানান",
    reviews: (r: string, n: number) => `Jachai-তে ${n}টি রিভিউ থেকে ${r}`,
    newOn: "Jachai-তে নতুন",
    scan: "স্ক্যান করুন",
    expired: "মেয়াদ শেষ",
    uploadHint: "আপনার ব্যানার আপলোড করুন",
  },
} as const;

export function formatPrice(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  return `৳${v.toLocaleString("en-IN", { maximumFractionDigits: v % 1 === 0 ? 0 : 2 })}`;
}

export function formatDay(iso: string | null | undefined, lang: "bn" | "en"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
}

export function formatDayTime(iso: string | null | undefined, lang: "bn" | "en"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "J";
}

// ---------------------------------------------------------------------------
// Context + text
// ---------------------------------------------------------------------------

interface Ctx {
  m: PromoRenderModel;
  format: CreativeFormat;
  w: number;
  h: number;
  u: number; // 1 unit = 1px on a 1080-wide canvas
  lang: "bn" | "en";
  qr: string | null | undefined;
  shape?: Shaper;
}

const flexCol: CSSProperties = { display: "flex", flexDirection: "column" };
const flexRow: CSSProperties = { display: "flex", flexDirection: "row", alignItems: "center" };

/**
 * One text run inside a box of `maxWidth` px, wrapped to at most `lines` lines with an ellipsis.
 * Server: HarfBuzz-shaped SVG image. Browser: native text with the same box and clamp.
 */
function tx(c: Ctx, text: string | null | undefined, o: ShapeOpts & { style?: CSSProperties }): ReactNode {
  if (!text || !text.trim()) return null;
  const { style, ...opts } = o;
  if (c.shape) {
    const s = c.shape(text, opts);
    if (!s) return null;
    return <img src={s.src} alt="" width={s.width} height={s.height} style={{ width: s.width, height: s.height, ...style }} />;
  }
  const lines = o.lines ?? 1;
  const dom: CSSProperties = {
    fontSize: o.size,
    fontWeight: o.weight ?? 400,
    color: o.color,
    maxWidth: o.maxWidth,
    lineHeight: o.lineHeight ?? 1.25,
    textAlign: o.align ?? "left",
    opacity: o.opacity,
    textDecoration: o.strike ? "line-through" : undefined,
    overflow: "hidden",
    ...(o.align && o.align !== "left" ? { width: o.maxWidth } : {}),
    ...(lines > 1
      ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" as const, overflowWrap: "anywhere" as const }
      : { display: "block", whiteSpace: "nowrap", textOverflow: "ellipsis" }),
    ...style,
  };
  return <div style={dom}>{text}</div>;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Logo({ c, size, ring = "#FFFFFF" }: { c: Ctx; size: number; ring?: string }) {
  const { m } = c;
  const border = `${Math.max(2, size / 24)}px solid ${ring}`;
  if (m.logoUrl) {
    return <img src={m.logoUrl} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover", border, background: "#fff" }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 2, background: "#FFFFFF", border }}>
      {tx(c, initialOf(m.businessName), { size: size * 0.46, weight: 700, color: m.accentColor, maxWidth: size, align: "center", lineHeight: 1 })}
    </div>
  );
}

/** Photo with an honest fallback when the owner has none: an accent block with the initial. */
function Photo({
  c,
  width,
  height,
  radius = 0,
  url,
  showInitial = true,
}: {
  c: Ctx;
  width: number;
  height: number;
  radius?: number;
  url?: string | null;
  /** Off when text is drawn on top of the photo (Minimal), so the big initial can't collide with it. */
  showInitial?: boolean;
}) {
  const { m } = c;
  const src = url === undefined ? m.photoUrl : url;
  if (src) {
    return <img src={src} alt="" width={width} height={height} style={{ width, height, objectFit: "cover", borderRadius: radius }} />;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        height,
        borderRadius: radius,
        backgroundImage: `linear-gradient(135deg, ${m.accentColor}, ${INK})`,
      }}
    >
      {showInitial
        ? tx(c, initialOf(m.businessName), { size: Math.min(width, height) * 0.35, weight: 700, color: "rgba(255,255,255,0.9)", maxWidth: width, align: "center", lineHeight: 1 })
        : null}
    </div>
  );
}

/** The same red 5-box rating the site uses (RatingBoxes), drawn for images. */
export function CreativeRatingBoxes({ rating, size, gap }: { rating: number; size: number; gap?: number }) {
  const full = Math.round(rating);
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: gap ?? size * 0.12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.14, background: i < full ? BRAND_RED : "#D1D5DB" }}
        >
          <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24">
            <path fill="#FFFFFF" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function Qr({ c, size, dark }: { c: Ctx; size: number; dark?: boolean }) {
  if (!c.m.showQr || !c.qr) return null;
  return (
    <div style={{ ...flexCol, alignItems: "center", gap: size * 0.05 }}>
      <img src={c.qr} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size * 0.06, background: "#fff", padding: size * 0.05 }} />
      {tx(c, LABELS[c.lang].scan, { size: size * 0.13, color: dark ? MUTED : "#FFFFFF", maxWidth: size * 1.4, align: "center" })}
    </div>
  );
}

function JachaiMark({ c, size, color }: { c: Ctx; size: number; color: string }) {
  return (
    <div style={{ ...flexRow, gap: size * 0.25 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 0.95, height: size * 0.95, borderRadius: size * 0.22, background: color }}>
        {tx(c, "J", { size: size * 0.62, weight: 700, color: color === "#FFFFFF" ? BRAND_RED : "#FFFFFF", maxWidth: size, align: "center", lineHeight: 1 })}
      </div>
      {tx(c, "jachai", { size, weight: 700, color, maxWidth: size * 5 })}
    </div>
  );
}

function Chip({ c, text, size, bg, color, maxWidth }: { c: Ctx; text: string | null; size: number; bg: string; color: string; maxWidth: number }) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", alignSelf: "flex-start", padding: `${size * 0.3}px ${size * 0.75}px`, borderRadius: 999, background: bg }}>
      {tx(c, text, { size, weight: 600, color, maxWidth: maxWidth - size * 1.5 })}
    </div>
  );
}

function ExpiredBand({ c }: { c: Ctx }) {
  const size = c.w * 0.09;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: c.w, height: c.h, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,24,39,0.45)" }}>
      <div style={{ display: "flex", padding: `${c.w * 0.02}px ${c.w * 0.06}px`, background: "#FFFFFF", borderRadius: c.w * 0.02, transform: "rotate(-8deg)" }}>
        {tx(c, LABELS[c.lang].expired, { size, weight: 700, color: BRAND_RED, maxWidth: c.w * 0.8, align: "center", lineHeight: 1.1 })}
      </div>
    </div>
  );
}

/** Old price struck through + current price. Only numbers from the model — never typed by the owner. */
function PriceLine({ c, size, color, maxWidth }: { c: Ctx; size: number; color: string; maxWidth: number }) {
  const { m } = c;
  if (!m.showPrice) return null;
  const oldP = formatPrice(m.offer?.originalPrice ?? null);
  const newP = formatPrice(m.offer?.offerPrice ?? m.menuItem?.price ?? null);
  const text = newP ?? m.menuItem?.priceText ?? null;
  if (!text) return null;
  return (
    <div style={{ ...flexRow, gap: size * 0.3 }}>
      {oldP && newP && tx(c, oldP, { size: size * 0.6, color, maxWidth: maxWidth * 0.4, strike: true, opacity: 0.75 })}
      {tx(c, text, { size, weight: 700, color, maxWidth: oldP && newP ? maxWidth * 0.6 : maxWidth })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function OfferBold(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const big = m.offer?.headlineText ?? m.headline ?? m.businessName;
  const itemName = m.menuItem?.name ?? m.offer?.title ?? null;
  const valid = m.offer?.validUntil ? L.validUntil(formatDay(m.offer.validUntil, lang)) : null;

  const header = (logo: number, name: number, width: number) => (
    <div style={{ ...flexRow, gap: logo * 0.22 }}>
      <Logo c={c} size={logo} />
      <div style={{ ...flexCol }}>
        {tx(c, m.businessName, { size: name, weight: 700, color: "#FFFFFF", maxWidth: width - logo * 1.25 })}
        {tx(c, m.areaName, { size: name * 0.7, color: "#FFFFFF", opacity: 0.85, maxWidth: width - logo * 1.25 })}
      </div>
    </div>
  );
  const details = (size: number, width: number) => (
    <div style={{ ...flexCol, gap: size * 0.3 }}>
      {tx(c, itemName, { size, weight: 600, color: "#FFFFFF", maxWidth: width, lines: 2, lineHeight: 1.2 })}
      <PriceLine c={c} size={size * 1.6} color="#FFFFFF" maxWidth={width} />
      <Chip c={c} text={valid} size={size * 0.7} bg="#FFFFFF" color={m.accentColor} maxWidth={width} />
    </div>
  );

  if (format === "OG") {
    const colW = w - h - 88;
    return (
      <div style={{ ...flexRow, width: w, height: h, background: m.accentColor, alignItems: "stretch" }}>
        <Photo c={c} width={h} height={h} />
        <div style={{ ...flexCol, width: w - h, padding: 44, justifyContent: "space-between" }}>
          {header(60, 28, colW)}
          {tx(c, big, { size: 76, weight: 700, color: "#FFFFFF", maxWidth: colW, lines: 2, lineHeight: 1.05 })}
          {details(28, colW)}
        </div>
      </div>
    );
  }
  const story = format === "STORY";
  const pad = 64 * u;
  const inner = w - pad * 2;
  return (
    <div style={{ ...flexCol, width: w, height: h, background: m.accentColor, padding: pad, justifyContent: "space-between" }}>
      {header(88 * u, 40 * u, inner)}
      <div style={{ ...flexCol, gap: 12 * u }}>
        {tx(c, big, { size: (story ? 170 : 140) * u, weight: 700, color: "#FFFFFF", maxWidth: inner, lines: 2, lineHeight: 1.02 })}
        {m.headline && m.headline !== big && tx(c, m.headline, { size: 44 * u, weight: 600, color: "#FFFFFF", maxWidth: inner, lines: 2, lineHeight: 1.2 })}
      </div>
      {story ? (
        <div style={{ ...flexCol, gap: 40 * u }}>
          <Photo c={c} width={inner} height={760 * u} radius={36 * u} />
          <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end" }}>
            {details(40 * u, inner - 240 * u)}
            <Qr c={c} size={190 * u} />
          </div>
        </div>
      ) : (
        <div style={{ ...flexRow, gap: 40 * u, alignItems: "flex-end" }}>
          <Photo c={c} width={430 * u} height={430 * u} radius={32 * u} />
          <div style={{ ...flexCol, width: inner - 470 * u, gap: 24 * u }}>
            {details(40 * u, inner - 470 * u)}
            <Qr c={c} size={150 * u} />
          </div>
        </div>
      )}
      <JachaiMark c={c} size={30 * u} color="#FFFFFF" />
    </div>
  );
}

function MenuHighlight(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const name = m.menuItem?.name ?? m.headline ?? m.businessName;
  const photoUrl = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const rating = (width: number) =>
    m.showRating && m.averageRating != null ? (
      <div style={{ ...flexRow, gap: 14 * u }}>
        <CreativeRatingBoxes rating={m.averageRating} size={36 * u} />
        {tx(c, L.reviews(m.averageRating.toFixed(1), m.reviewCount), { size: 28 * u, color: MUTED, maxWidth: width - 230 * u })}
      </div>
    ) : null;
  const cta = (size: number, width: number) => (
    <div style={{ display: "flex", alignSelf: "flex-start", padding: `${size * 0.5}px ${size * 1.1}px`, borderRadius: 999, background: m.accentColor }}>
      {tx(c, L.orderOn, { size, weight: 700, color: "#FFFFFF", maxWidth: width })}
    </div>
  );

  if (format === "OG") {
    const colW = w - 630 - 88;
    return (
      <div style={{ ...flexRow, width: w, height: h, background: "#FFFFFF", alignItems: "stretch" }}>
        <Photo c={c} width={630} height={630} url={photoUrl} />
        <div style={{ ...flexCol, width: w - 630, padding: 44, justifyContent: "center", gap: 18 }}>
          {tx(c, m.businessName, { size: 26, weight: 700, color: m.accentColor, maxWidth: colW })}
          {tx(c, name, { size: 54, weight: 700, color: INK, maxWidth: colW, lines: 2, lineHeight: 1.12 })}
          <PriceLine c={c} size={44} color={m.accentColor} maxWidth={colW} />
          {cta(26, colW)}
        </div>
      </div>
    );
  }
  const story = format === "STORY";
  const photoH = story ? 1100 * u : 540 * u;
  const pad = 56 * u;
  const inner = w - pad * 2;
  const qrSize = (story ? 180 : 140) * u;
  return (
    <div style={{ ...flexCol, width: w, height: h, background: "#FFFFFF" }}>
      <div style={{ display: "flex", position: "relative", width: w, height: photoH }}>
        <Photo c={c} width={w} height={photoH} url={photoUrl} />
        <div style={{ ...flexRow, position: "absolute", top: 40 * u, left: 40 * u, gap: 14 * u, padding: `${10 * u}px ${24 * u}px ${10 * u}px ${10 * u}px`, background: "rgba(255,255,255,0.95)", borderRadius: 999 }}>
          <Logo c={c} size={56 * u} ring={m.accentColor} />
          {tx(c, m.businessName, { size: 28 * u, weight: 700, color: INK, maxWidth: 560 * u })}
        </div>
      </div>
      <div style={{ ...flexCol, flexGrow: 1, padding: `${36 * u}px ${pad}px`, gap: 16 * u, justifyContent: "center", borderTop: `${10 * u}px solid ${m.accentColor}` }}>
        {tx(c, name, { size: (story ? 76 : 60) * u, weight: 700, color: INK, maxWidth: inner, lines: 2, lineHeight: 1.1 })}
        {tx(c, m.subline, { size: 30 * u, color: MUTED, maxWidth: inner, lines: story ? 2 : 1 })}
        <div style={{ ...flexRow, justifyContent: "space-between" }}>
          <div style={{ ...flexCol, gap: 14 * u }}>
            <PriceLine c={c} size={52 * u} color={m.accentColor} maxWidth={inner - qrSize - 20 * u} />
            {cta(30 * u, inner - qrSize - 80 * u)}
          </div>
          <Qr c={c} size={qrSize} dark />
        </div>
        {rating(inner)}
      </div>
    </div>
  );
}

function Minimal(c: Ctx) {
  const { m, format, w, h, u } = c;
  const headline = m.headline ?? m.offer?.headlineText ?? m.menuItem?.name ?? m.businessName;
  const k = format === "OG" ? 0.62 : u;
  const pad = 64 * k;
  const inner = w - pad * 2;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: INK }}>
      <Photo c={c} width={w} height={h} showInitial={false} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0) 35%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78))",
        }}
      >
        <div style={{ ...flexRow, justifyContent: "space-between" }}>
          <div style={{ ...flexRow, gap: 18 * k }}>
            <Logo c={c} size={84 * k} />
            {tx(c, m.businessName, { size: 34 * k, weight: 700, color: "#FFFFFF", maxWidth: inner - 300 * k })}
          </div>
          <Qr c={c} size={130 * k} />
        </div>
        <div style={{ ...flexCol, gap: 14 * k }}>
          {tx(c, headline, { size: (format === "STORY" ? 110 : 92) * k, weight: 700, color: "#FFFFFF", maxWidth: inner, lines: 3, lineHeight: 1.05 })}
          {tx(c, m.subline, { size: 36 * k, color: "#FFFFFF", opacity: 0.92, maxWidth: inner, lines: 2 })}
          <div style={{ ...flexRow, justifyContent: "space-between" }}>
            {tx(c, [m.areaName, m.cityName].filter(Boolean).join(", "), { size: 30 * k, color: "#FFFFFF", opacity: 0.9, maxWidth: inner - 220 * k })}
            <JachaiMark c={c} size={28 * k} color="#FFFFFF" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EventPoster(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const title = m.event?.title ?? m.headline ?? m.businessName;
  const when = m.event ? formatDayTime(m.event.start, lang) : null;
  const where = m.event?.location ?? [m.areaName, m.cityName].filter(Boolean).join(", ");

  if (format === "OG") {
    const colW = 700 - 96;
    return (
      <div style={{ ...flexRow, width: w, height: h, background: "#FFFFFF", alignItems: "stretch" }}>
        <div style={{ ...flexCol, width: 700, padding: 48, background: m.accentColor, justifyContent: "space-between" }}>
          <div style={{ ...flexRow, gap: 16 }}>
            <Logo c={c} size={60} />
            {tx(c, m.businessName, { size: 26, weight: 700, color: "#FFFFFF", maxWidth: colW - 80 })}
          </div>
          {tx(c, title, { size: 64, weight: 700, color: "#FFFFFF", maxWidth: colW, lines: 3, lineHeight: 1.08 })}
          {tx(c, when, { size: 28, weight: 600, color: "#FFFFFF", maxWidth: colW })}
        </div>
        <Photo c={c} width={w - 700} height={h} />
      </div>
    );
  }
  const story = format === "STORY";
  const pad = 64 * u;
  const inner = w - pad * 2;
  const qrSize = (story ? 190 : 140) * u;
  return (
    <div style={{ ...flexCol, width: w, height: h, background: "#FFFFFF" }}>
      <div style={{ ...flexCol, padding: pad, background: m.accentColor, gap: 24 * u }}>
        <div style={{ ...flexRow, gap: 18 * u }}>
          <Logo c={c} size={72 * u} />
          {tx(c, m.businessName, { size: 32 * u, weight: 700, color: "#FFFFFF", maxWidth: inner - 90 * u })}
        </div>
        {tx(c, title, { size: (story ? 112 : 84) * u, weight: 700, color: "#FFFFFF", maxWidth: inner, lines: 3, lineHeight: 1.06 })}
        <Chip c={c} text={when} size={30 * u} bg="#FFFFFF" color={m.accentColor} maxWidth={inner} />
      </div>
      <Photo c={c} width={w} height={(story ? 900 : 380) * u} />
      <div style={{ ...flexRow, flexGrow: 1, padding: `${32 * u}px ${pad}px`, justifyContent: "space-between" }}>
        <div style={{ ...flexCol, gap: 10 * u }}>
          {tx(c, where, { size: 32 * u, weight: 600, color: INK, maxWidth: inner - qrSize - 30 * u })}
          {tx(c, L.interested, { size: 32 * u, weight: 700, color: m.accentColor, maxWidth: inner - qrSize - 30 * u })}
        </div>
        <Qr c={c} size={qrSize} dark />
      </div>
    </div>
  );
}

function RatingShowcase(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const hasRating = m.averageRating != null && m.reviewCount > 0;
  const og = format === "OG";
  const k = og ? 0.58 : u;
  const pad = 72 * k;
  const inner = w - pad * 2;
  const align = og ? "left" : "center";
  return (
    <div style={{ ...flexCol, width: w, height: h, background: "#FFF8F3", padding: pad, justifyContent: "space-between" }}>
      <div style={{ ...flexRow, justifyContent: "space-between" }}>
        <div style={{ ...flexRow, gap: 20 * k }}>
          <Logo c={c} size={96 * k} ring={m.accentColor} />
          <div style={{ ...flexCol }}>
            {tx(c, m.businessName, { size: 40 * k, weight: 700, color: INK, maxWidth: inner - 330 * k })}
            {tx(c, m.areaName, { size: 28 * k, color: MUTED, maxWidth: inner - 330 * k })}
          </div>
        </div>
        <Qr c={c} size={140 * k} dark />
      </div>
      <div style={{ ...flexCol, gap: 26 * k, alignItems: og ? "flex-start" : "center" }}>
        {hasRating ? (
          // A real element, not a fragment: Satori lays fragments out as a row.
          <div style={{ ...flexCol, gap: 22 * k, alignItems: og ? "flex-start" : "center" }}>
            <CreativeRatingBoxes rating={m.averageRating!} size={(og ? 110 : 128) * k} gap={18 * k} />
            {tx(c, L.reviews(m.averageRating!.toFixed(1), m.reviewCount), { size: 48 * k, weight: 700, color: INK, maxWidth: inner, align, lines: 2 })}
          </div>
        ) : (
          tx(c, m.headline ?? L.newOn, { size: 72 * k, weight: 700, color: INK, maxWidth: inner, align, lines: 2 })
        )}
        {hasRating && m.quote && (
          <div style={{ ...flexCol, gap: 10 * k, alignItems: og ? "flex-start" : "center" }}>
            {tx(c, `“${m.quote.text}”`, { size: (format === "STORY" ? 48 : 40) * k, color: INK, maxWidth: inner - 60 * k, align, lines: 4, lineHeight: 1.35 })}
            {tx(c, `— ${m.quote.firstName}`, { size: 30 * k, color: MUTED, maxWidth: inner, align })}
          </div>
        )}
        {hasRating && tx(c, m.headline, { size: 36 * k, weight: 700, color: m.accentColor, maxWidth: inner, align })}
      </div>
      <div style={{ ...flexRow, justifyContent: "space-between" }}>
        {tx(c, m.subline, { size: 28 * k, color: MUTED, maxWidth: inner - 220 * k }) ?? <div style={{ display: "flex" }} />}
        <JachaiMark c={c} size={30 * k} color={BRAND_RED} />
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// V61 templates
// ---------------------------------------------------------------------------

/**
 * "Your own design": the owner's uploaded banner, placed into each format exactly as designed —
 * no text drawn on top. FIT shows the whole image on a brand-colour backdrop; FILL crops to fill.
 */
function Custom(c: Ctx) {
  const { m, w, h, u, lang } = c;
  const k = c.format === "OG" ? 0.58 : u;
  if (!m.photoUrl) {
    return (
      <div style={{ ...flexCol, width: w, height: h, alignItems: "center", justifyContent: "center", gap: 24 * k, background: "#F3F4F6" }}>
        <div style={{ display: "flex", width: 140 * k, height: 140 * k, borderRadius: 28 * k, border: `${6 * k}px dashed #9CA3AF` }} />
        {tx(c, LABELS[lang].uploadHint, { size: 48 * k, weight: 600, color: MUTED, maxWidth: w * 0.8, align: "center", lines: 2 })}
      </div>
    );
  }
  const fill = m.imageFit === "FILL";
  return (
    <div style={{ display: "flex", width: w, height: h, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(135deg, ${m.accentColor}, ${INK})` }}>
      <img src={m.photoUrl} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: fill ? "cover" : "contain" }} />
    </div>
  );
}

function headlineOf(m: PromoRenderModel): string {
  return m.headline ?? m.event?.title ?? m.offer?.headlineText ?? m.menuItem?.name ?? m.businessName;
}

/** Photo on top (left on OG), a clean white text panel with an accent rule. */
function SplitPhoto(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const photo = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const panel = (k: number, width: number, story: boolean) => (
    <div
      style={{
        ...flexCol,
        flexGrow: 1,
        width,
        padding: 52 * k,
        justifyContent: "space-between",
        background: "#FFFFFF",
        ...(og ? { borderLeft: `${12 * k}px solid ${m.accentColor}` } : { borderTop: `${12 * k}px solid ${m.accentColor}` }),
      }}
    >
      <div style={{ ...flexRow, gap: 16 * k }}>
        <Logo c={c} size={64 * k} ring={m.accentColor} />
        <div style={{ ...flexCol }}>
          {tx(c, m.businessName, { size: 30 * k, weight: 700, color: INK, maxWidth: width - 200 * k })}
          {tx(c, m.areaName, { size: 24 * k, color: MUTED, maxWidth: width - 200 * k })}
        </div>
      </div>
      <div style={{ ...flexCol, gap: 12 * k }}>
        {tx(c, headlineOf(m), { size: (story ? 88 : 70) * k, weight: 700, color: INK, maxWidth: width - 104 * k, lines: 2, lineHeight: 1.08 })}
        {tx(c, m.subline, { size: 32 * k, color: MUTED, maxWidth: width - 104 * k, lines: story ? 3 : 1, lineHeight: 1.3 })}
        <PriceLine c={c} size={54 * k} color={m.accentColor} maxWidth={width - 104 * k} />
      </div>
      <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end" }}>
        <JachaiMark c={c} size={28 * k} color={m.accentColor} />
        <Qr c={c} size={(story ? 170 : 120) * k} dark />
      </div>
    </div>
  );
  if (og) {
    return (
      <div style={{ ...flexRow, width: w, height: h, alignItems: "stretch" }}>
        <Photo c={c} width={560} height={h} url={photo} />
        {panel(0.62, w - 560, false)}
      </div>
    );
  }
  const story = format === "STORY";
  return (
    <div style={{ ...flexCol, width: w, height: h }}>
      <Photo c={c} width={w} height={(story ? 1000 : 540) * u} url={photo} />
      {panel(u, w, story)}
    </div>
  );
}

/** A big round price tag over the item photo, on the brand colour. */
function PriceSpotlight(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const photo = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const name = m.menuItem?.name ?? m.offer?.title ?? headlineOf(m);
  const price = formatPrice(m.offer?.offerPrice ?? m.menuItem?.price ?? null) ?? m.menuItem?.priceText ?? m.offer?.headlineText ?? null;
  const oldPrice = m.offer?.originalPrice != null && m.offer?.offerPrice != null ? formatPrice(m.offer.originalPrice) : null;
  const valid = m.offer?.validUntil ? L.validUntil(formatDay(m.offer.validUntil, lang)) : null;

  const tag = (size: number) =>
    m.showPrice && price ? (
      <div
        style={{
          ...flexCol,
          position: "absolute",
          right: size * 0.08,
          bottom: size * 0.08,
          width: size,
          height: size,
          borderRadius: size / 2,
          background: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          border: `${size * 0.035}px solid ${GOLD}`,
        }}
      >
        {oldPrice && tx(c, oldPrice, { size: size * 0.13, color: MUTED, maxWidth: size * 0.8, align: "center", strike: true })}
        {tx(c, price, { size: size * (Array.from(price).length > 6 ? 0.17 : 0.22), weight: 700, color: m.accentColor, maxWidth: size * 0.84, align: "center", lineHeight: 1.05, lines: 2 })}
      </div>
    ) : null;

  if (format === "OG") {
    const colW = w - 630 - 88;
    return (
      <div style={{ ...flexRow, width: w, height: h, background: m.accentColor, alignItems: "stretch" }}>
        <div style={{ display: "flex", position: "relative", width: 630, height: 630 }}>
          <Photo c={c} width={630} height={630} url={photo} />
          {tag(230)}
        </div>
        <div style={{ ...flexCol, width: w - 630, padding: 44, justifyContent: "space-between" }}>
          <div style={{ ...flexRow, gap: 14 }}>
            <Logo c={c} size={56} />
            {tx(c, m.businessName, { size: 26, weight: 700, color: "#FFFFFF", maxWidth: colW - 70 })}
          </div>
          {tx(c, name, { size: 56, weight: 700, color: "#FFFFFF", maxWidth: colW, lines: 3, lineHeight: 1.1 })}
          <Chip c={c} text={valid} size={24} bg="#FFFFFF" color={m.accentColor} maxWidth={colW} />
        </div>
      </div>
    );
  }
  const story = format === "STORY";
  const pad = 56 * u;
  const inner = w - pad * 2;
  const photoH = (story ? 980 : 520) * u;
  return (
    <div style={{ ...flexCol, width: w, height: h, background: m.accentColor, padding: pad, justifyContent: "space-between" }}>
      <div style={{ ...flexRow, justifyContent: "space-between" }}>
        <div style={{ ...flexRow, gap: 18 * u }}>
          <Logo c={c} size={76 * u} />
          {tx(c, m.businessName, { size: 34 * u, weight: 700, color: "#FFFFFF", maxWidth: inner - 260 * u })}
        </div>
        <JachaiMark c={c} size={26 * u} color="#FFFFFF" />
      </div>
      <div style={{ display: "flex", position: "relative", width: inner, height: photoH }}>
        <Photo c={c} width={inner} height={photoH} radius={40 * u} url={photo} />
        {tag((story ? 330 : 270) * u)}
      </div>
      <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end", gap: 24 * u }}>
        <div style={{ ...flexCol, gap: 16 * u }}>
          {tx(c, name, { size: (story ? 84 : 62) * u, weight: 700, color: "#FFFFFF", maxWidth: inner - (m.showQr && c.qr ? 190 * u : 0), lines: 2, lineHeight: 1.08 })}
          <Chip c={c} text={valid} size={28 * u} bg="#FFFFFF" color={m.accentColor} maxWidth={inner} />
        </div>
        <Qr c={c} size={(story ? 170 : 140) * u} />
      </div>
    </div>
  );
}

function Dots({ count, size }: { count: number; size: number }) {
  return (
    <div style={{ ...flexRow, gap: size * 1.4, justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: "flex", width: size, height: size, borderRadius: size / 2, background: GOLD, opacity: i % 2 === 0 ? 1 : 0.55 }} />
      ))}
    </div>
  );
}

/** Eid / Puja / Pohela Boishakh greeting or offer — deep backdrop, gold frame, centred type. */
function Festive(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const story = format === "STORY";
  const k = og ? 0.56 : u;
  const pad = 44 * k;
  const frameW = w - pad * 2;
  const inner = frameW - 120 * k;
  const offerLine = m.offer?.headlineText ?? null;
  return (
    <div style={{ display: "flex", width: w, height: h, padding: pad, backgroundImage: `linear-gradient(160deg, ${m.accentColor}, #1A0B2E)` }}>
      <div
        style={{
          ...flexCol,
          width: frameW,
          height: h - pad * 2,
          border: `${5 * k}px solid ${GOLD}`,
          borderRadius: 36 * k,
          padding: `${36 * k}px ${60 * k}px`,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Dots count={og ? 11 : 9} size={12 * k} />
        <div style={{ ...flexCol, alignItems: "center", gap: (story ? 34 : og ? 14 : 22) * k }}>
          {!og && <Logo c={c} size={120 * k} ring={GOLD} />}
          {tx(c, m.businessName, { size: 34 * k, weight: 600, color: GOLD, maxWidth: inner, align: "center" })}
          {tx(c, headlineOf(m), { size: (story ? 112 : og ? 104 : 92) * k, weight: 700, color: "#FFFFFF", maxWidth: inner, align: "center", lines: og ? 2 : 3, lineHeight: 1.1 })}
          {tx(c, m.subline, { size: 36 * k, color: "#FFFFFF", opacity: 0.9, maxWidth: inner, align: "center", lines: story ? 3 : og ? 1 : 2, lineHeight: 1.3 })}
          {offerLine && (
            <div style={{ display: "flex", padding: `${12 * k}px ${36 * k}px`, borderRadius: 999, background: GOLD }}>
              {tx(c, offerLine, { size: 40 * k, weight: 700, color: "#1A0B2E", maxWidth: inner - 72 * k })}
            </div>
          )}
        </div>
        <div style={{ ...flexCol, alignItems: "center", gap: 14 * k }}>
          {!og && <Qr c={c} size={(story ? 170 : 120) * k} />}
          <JachaiMark c={c} size={24 * k} color={GOLD} />
          <Dots count={og ? 11 : 9} size={12 * k} />
        </div>
      </div>
    </div>
  );
}

/** A huge headline on the brand colour — needs no photo, so it works for every business. */
function BigAnnouncement(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const story = format === "STORY";
  const k = og ? 0.58 : u;
  const pad = 72 * k;
  const inner = w - pad * 2;
  return (
    <div style={{ ...flexCol, position: "relative", width: w, height: h, padding: pad, background: m.accentColor, justifyContent: "space-between", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", top: -260 * k, right: -220 * k, width: 720 * k, height: 720 * k, borderRadius: 360 * k, background: "rgba(255,255,255,0.10)" }} />
      <div style={{ display: "flex", position: "absolute", bottom: -180 * k, left: -160 * k, width: 420 * k, height: 420 * k, borderRadius: 210 * k, background: "rgba(0,0,0,0.12)" }} />
      <div style={{ display: "flex", width: 120 * k, height: 14 * k, borderRadius: 7 * k, background: "#FFFFFF" }} />
      <div style={{ ...flexCol, gap: 24 * k }}>
        {tx(c, headlineOf(m), { size: (story ? 150 : og ? 120 : 124) * k, weight: 700, color: "#FFFFFF", maxWidth: inner, lines: og ? 2 : story ? 5 : 4, lineHeight: 1.02 })}
        {tx(c, m.subline, { size: (story ? 46 : 40) * k, color: "#FFFFFF", opacity: 0.92, maxWidth: inner, lines: story ? 4 : 2, lineHeight: 1.3 })}
      </div>
      <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ ...flexRow, gap: 18 * k }}>
          <Logo c={c} size={84 * k} />
          <div style={{ ...flexCol }}>
            {tx(c, m.businessName, { size: 34 * k, weight: 700, color: "#FFFFFF", maxWidth: inner - 360 * k })}
            {tx(c, [m.areaName, m.cityName].filter(Boolean).join(", "), { size: 26 * k, color: "#FFFFFF", opacity: 0.85, maxWidth: inner - 360 * k })}
          </div>
        </div>
        {m.showQr && c.qr ? <Qr c={c} size={(story ? 180 : 140) * k} /> : <JachaiMark c={c} size={28 * k} color="#FFFFFF" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V62 premium templates
// ---------------------------------------------------------------------------

const CHAMPAGNE = "#D4AF6A";
const IVORY = "#F5F1E8";

/** Current price text for premium layouts — only from the model, and only when the owner shows prices. */
function priceOf(m: PromoRenderModel): { now: string | null; was: string | null } {
  if (!m.showPrice) return { now: null, was: null };
  const now = formatPrice(m.offer?.offerPrice ?? m.menuItem?.price ?? null) ?? m.menuItem?.priceText ?? null;
  const was = now && m.offer?.originalPrice != null && m.offer?.offerPrice != null ? formatPrice(m.offer.originalPrice) : null;
  return { now, was };
}

/** Photo in an arch (rounded top) with a thin gold keyline around it. */
function ArchPhoto({ c, width, height }: { c: Ctx; width: number; height: number }) {
  const { m } = c;
  const src = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const gap = Math.max(6, width * 0.025);
  const inW = width - gap * 2;
  const inH = height - gap * 2;
  const outer = { borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2, borderBottomLeftRadius: width * 0.04, borderBottomRightRadius: width * 0.04 };
  const inner = { borderTopLeftRadius: inW / 2, borderTopRightRadius: inW / 2, borderBottomLeftRadius: inW * 0.03, borderBottomRightRadius: inW * 0.03 };
  return (
    <div style={{ display: "flex", width, height, padding: gap, border: `${Math.max(2, width * 0.005)}px solid ${CHAMPAGNE}`, ...outer }}>
      {src ? (
        <img src={src} alt="" width={inW} height={inH} style={{ width: inW, height: inH, objectFit: "cover", ...inner }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: inW, height: inH, backgroundImage: `linear-gradient(160deg, ${m.accentColor}, #0E0E10)`, ...inner }}>
          {tx(c, Array.from(m.businessName.trim())[0]?.toUpperCase() ?? "J", { size: inW * 0.32, weight: 700, color: CHAMPAGNE, maxWidth: inW, align: "center", lineHeight: 1 })}
        </div>
      )}
    </div>
  );
}

function GoldRule({ width, k }: { width: number; k: number }) {
  return <div style={{ display: "flex", width, height: Math.max(2, 2 * k), background: CHAMPAGNE }} />;
}

/** Luxe: near-black, champagne gold, arch-framed photo — fine dining, salons, boutiques. */
function Luxe(c: Ctx) {
  const { m, format, w, h, u, lang } = c;
  const L = LABELS[lang];
  const { now, was } = priceOf(m);
  const valid = m.offer?.validUntil ? L.validUntil(formatDay(m.offer.validUntil, lang)) : null;

  const text = (k: number, width: number, center: boolean, big: number) => {
    const align = center ? "center" : "left";
    return (
      <div style={{ ...flexCol, gap: 22 * k, alignItems: center ? "center" : "flex-start" }}>
        {tx(c, m.businessName, { size: 30 * k, weight: 600, color: CHAMPAGNE, maxWidth: width, align })}
        {tx(c, headlineOf(m), { size: big * k, weight: 700, color: IVORY, maxWidth: width, align, lines: 3, lineHeight: 1.1 })}
        <GoldRule width={90 * k} k={k} />
        {tx(c, m.subline, { size: 32 * k, color: "#A8A29E", maxWidth: width, align, lines: 3, lineHeight: 1.35 })}
        {now && (
          <div style={{ ...flexRow, gap: 16 * k }}>
            {was && tx(c, was, { size: 30 * k, color: "#A8A29E", maxWidth: width * 0.35, strike: true })}
            {tx(c, now, { size: 56 * k, weight: 700, color: CHAMPAGNE, maxWidth: width * 0.6 })}
          </div>
        )}
        {valid && tx(c, valid, { size: 26 * k, color: IVORY, opacity: 0.8, maxWidth: width, align })}
      </div>
    );
  };
  const footer = (k: number) => (
    <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end" }}>
      <div style={{ ...flexRow, gap: 14 * k }}>
        <Logo c={c} size={56 * k} ring={CHAMPAGNE} />
        {tx(c, [m.areaName, m.cityName].filter(Boolean).join(", "), { size: 24 * k, color: "#A8A29E", maxWidth: 420 * k })}
      </div>
      {m.showQr && c.qr ? <Qr c={c} size={120 * k} /> : <JachaiMark c={c} size={24 * k} color={CHAMPAGNE} />}
    </div>
  );

  if (format === "OG") {
    const k = 0.6;
    return (
      <div style={{ ...flexRow, width: w, height: h, background: "#0E0E10", padding: 44, gap: 44, alignItems: "center" }}>
        <ArchPhoto c={c} width={360} height={540} />
        <div style={{ ...flexCol, width: w - 360 - 132, height: 540, justifyContent: "space-between" }}>
          {text(k, w - 360 - 132, false, 96)}
          {footer(k)}
        </div>
      </div>
    );
  }
  if (format === "STORY") {
    const pad = 72 * u;
    const inner = w - pad * 2;
    return (
      <div style={{ ...flexCol, width: w, height: h, background: "#0E0E10", padding: pad, alignItems: "center", justifyContent: "space-between" }}>
        <ArchPhoto c={c} width={700 * u} height={880 * u} />
        {text(u, inner, true, 92)}
        <div style={{ ...flexCol, width: inner }}>{footer(u)}</div>
      </div>
    );
  }
  const pad = 72 * u;
  const inner = w - pad * 2;
  const archW = 400 * u;
  const colW = inner - archW - 56 * u;
  return (
    <div style={{ ...flexCol, width: w, height: h, background: "#0E0E10", padding: pad, justifyContent: "space-between" }}>
      <div style={{ ...flexRow, gap: 56 * u, alignItems: "center" }}>
        <ArchPhoto c={c} width={archW} height={700 * u} />
        <div style={{ ...flexCol, width: colW }}>{text(u, colW, false, 70)}</div>
      </div>
      {footer(u)}
    </div>
  );
}

/** Magazine cover: full-bleed photo, masthead, cover lines and a price badge. */
function Magazine(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const story = format === "STORY";
  const k = og ? 0.58 : u;
  const pad = 64 * k;
  const inner = w - pad * 2;
  const { now, was } = priceOf(m);
  const badgeText = now ?? m.offer?.headlineText ?? null;
  const badge = (size: number) =>
    badgeText ? (
      <div style={{ ...flexCol, width: size, height: size, borderRadius: size / 2, background: m.accentColor, alignItems: "center", justifyContent: "center", border: `${size * 0.03}px solid #FFFFFF`, transform: "rotate(-8deg)" }}>
        {was && tx(c, was, { size: size * 0.12, color: "#FFFFFF", opacity: 0.85, maxWidth: size * 0.8, align: "center", strike: true })}
        {tx(c, badgeText, { size: size * (Array.from(badgeText).length > 7 ? 0.15 : 0.21), weight: 700, color: "#FFFFFF", maxWidth: size * 0.82, align: "center", lines: 2, lineHeight: 1.05 })}
      </div>
    ) : null;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: INK }}>
      <Photo c={c} width={w} height={h} url={m.photoUrl ?? m.menuItem?.photoUrl ?? null} showInitial={false} />
      <div
        style={{
          ...flexCol,
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          padding: pad,
          justifyContent: "space-between",
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.62), rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.82))",
        }}
      >
        <div style={{ ...flexCol, gap: 10 * k }}>
          {tx(c, m.businessName, { size: (story ? 120 : og ? 104 : 108) * k, weight: 700, color: "#FFFFFF", maxWidth: inner, lineHeight: 1 })}
          <div style={{ ...flexRow, gap: 16 * k }}>
            <div style={{ display: "flex", width: 70 * k, height: 5 * k, background: m.accentColor }} />
            {tx(c, [m.areaName, m.cityName].filter(Boolean).join(" · "), { size: 28 * k, weight: 600, color: "#FFFFFF", maxWidth: inner - 100 * k })}
          </div>
        </div>
        <div style={{ ...flexRow, justifyContent: "flex-end" }}>{badge((story ? 300 : og ? 330 : 250) * k)}</div>
        <div style={{ ...flexCol, gap: 18 * k }}>
          <div style={{ ...flexRow, gap: 22 * k, alignItems: "stretch" }}>
            <div style={{ display: "flex", width: 10 * k, background: m.accentColor, borderRadius: 5 * k }} />
            <div style={{ ...flexCol, gap: 10 * k }}>
              {tx(c, headlineOf(m), { size: (story ? 92 : 76) * k, weight: 700, color: "#FFFFFF", maxWidth: inner - 40 * k, lines: og ? 2 : 3, lineHeight: 1.06 })}
              {tx(c, m.subline, { size: 34 * k, color: "#FFFFFF", opacity: 0.92, maxWidth: inner - 40 * k, lines: 2, lineHeight: 1.3 })}
            </div>
          </div>
          <div style={{ ...flexRow, justifyContent: "space-between", alignItems: "flex-end" }}>
            <JachaiMark c={c} size={28 * k} color="#FFFFFF" />
            <Qr c={c} size={(story ? 170 : 130) * k} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Glass: vivid gradient, soft light blobs and a frosted card — launches and offers. */
function Glass(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const story = format === "STORY";
  const k = og ? 0.62 : u;
  const pad = 64 * k;
  const { now, was } = priceOf(m);
  const photoSrc = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const circle = (size: number) => (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size / 2, border: `${8 * k}px solid rgba(255,255,255,0.85)`, overflow: "hidden" }}>
      <Photo c={c} width={size - 16 * k} height={size - 16 * k} radius={size / 2} url={photoSrc} />
    </div>
  );
  const pill = now ? (
    <div style={{ ...flexRow, alignSelf: og ? "flex-start" : "center", gap: 14 * k, padding: `${14 * k}px ${34 * k}px`, borderRadius: 999, background: "#FFFFFF" }}>
      {was && tx(c, was, { size: 28 * k, color: MUTED, maxWidth: 200 * k, strike: true })}
      {tx(c, now, { size: 46 * k, weight: 700, color: m.accentColor, maxWidth: 360 * k })}
    </div>
  ) : m.offer?.headlineText ? (
    <div style={{ display: "flex", alignSelf: og ? "flex-start" : "center", padding: `${14 * k}px ${34 * k}px`, borderRadius: 999, background: "#FFFFFF" }}>
      {tx(c, m.offer.headlineText, { size: 40 * k, weight: 700, color: m.accentColor, maxWidth: 600 * k })}
    </div>
  ) : null;
  const blob = (size: number, top: number, left: number, color: string) => (
    <div style={{ display: "flex", position: "absolute", top, left, width: size, height: size, borderRadius: size / 2, backgroundImage: `radial-gradient(circle, ${color}, rgba(255,255,255,0) 70%)` }} />
  );
  const cardW = w - pad * 2;
  const textW = og ? cardW - 400 * k - 160 * k : cardW - 120 * k;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, padding: pad, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(135deg, ${m.accentColor}, #7C3AED 55%, #F59E0B)` }}>
      {blob(700 * k, -200 * k, -220 * k, "rgba(255,255,255,0.35)")}
      {blob(600 * k, h - 380 * k, w - 380 * k, "rgba(255,214,102,0.45)")}
      <div
        style={{
          display: "flex",
          flexDirection: og ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: (og ? 48 : story ? 40 : 26) * k,
          width: cardW,
          ...(og || story ? { height: h - pad * 2 } : {}),
          padding: `${(story ? 72 : 52) * k}px ${60 * k}px`,
          borderRadius: 48 * k,
          background: "rgba(255,255,255,0.16)",
          border: `${2 * k}px solid rgba(255,255,255,0.5)`,
          boxShadow: "0 30px 60px rgba(0,0,0,0.18)",
        }}
      >
        {circle((og ? 400 : story ? 440 : 290) * k)}
        <div style={{ ...flexCol, alignItems: og ? "flex-start" : "center", gap: 18 * k, width: textW }}>
          <div style={{ ...flexRow, gap: 14 * k }}>
            <Logo c={c} size={52 * k} />
            {tx(c, m.businessName, { size: 30 * k, weight: 700, color: "#FFFFFF", maxWidth: textW - 70 * k })}
          </div>
          {tx(c, headlineOf(m), { size: (story ? 96 : 70) * k, weight: 700, color: "#FFFFFF", maxWidth: textW, align: og ? "left" : "center", lines: 2, lineHeight: 1.08 })}
          {tx(c, m.subline, { size: 32 * k, color: "#FFFFFF", opacity: 0.92, maxWidth: textW, align: og ? "left" : "center", lines: story ? 3 : 1, lineHeight: 1.3 })}
          {pill}
          {story && <Qr c={c} size={170 * k} />}
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", bottom: 30 * k, right: pad }}>
        <JachaiMark c={c} size={24 * k} color="#FFFFFF" />
      </div>
    </div>
  );
}

/** Polaroid: a tilted instant-photo print on warm paper — cafés, bakeries, home kitchens. */
function Polaroid(c: Ctx) {
  const { m, format, w, h, u } = c;
  const og = format === "OG";
  const story = format === "STORY";
  const k = og ? 0.6 : u;
  const pad = 64 * k;
  const { now, was } = priceOf(m);
  const photoSrc = m.photoUrl ?? m.menuItem?.photoUrl ?? null;
  const print = (photo: number, tilt: number) => (
    <div style={{ display: "flex", position: "relative", transform: `rotate(${tilt}deg)` }}>
      <div style={{ ...flexCol, padding: `${photo * 0.05}px ${photo * 0.05}px ${photo * 0.2}px`, background: "#FFFFFF", boxShadow: "0 18px 40px rgba(60,40,20,0.22)", gap: photo * 0.04 }}>
        <Photo c={c} width={photo} height={photo} url={photoSrc} />
        {tx(c, headlineOf(m), { size: photo * 0.075, weight: 600, color: INK, maxWidth: photo, align: "center" })}
      </div>
      <div style={{ display: "flex", position: "absolute", top: -photo * 0.04, left: photo * 0.38, width: photo * 0.34, height: photo * 0.09, background: "rgba(255,226,140,0.8)", transform: "rotate(-4deg)" }} />
    </div>
  );
  const details = (width: number, center: boolean) => (
    <div style={{ ...flexCol, gap: 16 * k, alignItems: center ? "center" : "flex-start" }}>
      <div style={{ ...flexRow, gap: 14 * k }}>
        <Logo c={c} size={60 * k} ring={m.accentColor} />
        <div style={{ ...flexCol }}>
          {tx(c, m.businessName, { size: 32 * k, weight: 700, color: INK, maxWidth: width - 80 * k })}
          {tx(c, [m.areaName, m.cityName].filter(Boolean).join(", "), { size: 24 * k, color: MUTED, maxWidth: width - 80 * k })}
        </div>
      </div>
      {tx(c, m.subline, { size: 32 * k, color: "#5B4636", maxWidth: width, align: center ? "center" : "left", lines: 2, lineHeight: 1.3 })}
      {now && (
        <div style={{ ...flexRow, gap: 14 * k }}>
          {was && tx(c, was, { size: 30 * k, color: MUTED, maxWidth: width * 0.35, strike: true })}
          {tx(c, now, { size: 54 * k, weight: 700, color: m.accentColor, maxWidth: width * 0.6 })}
        </div>
      )}
    </div>
  );
  const paper = "#F4ECE1";
  if (og) {
    const colW = w - 470 - pad * 2 - 40;
    return (
      <div style={{ ...flexRow, width: w, height: h, padding: pad, gap: 40, background: paper, alignItems: "center", borderTop: `${10 * k}px solid ${m.accentColor}` }}>
        <div style={{ display: "flex", width: 470, justifyContent: "center" }}>{print(330, -4)}</div>
        <div style={{ ...flexCol, width: colW, gap: 24 }}>
          {details(colW, false)}
          <JachaiMark c={c} size={22} color={m.accentColor} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...flexCol, width: w, height: h, padding: pad, background: paper, alignItems: "center", justifyContent: story ? "center" : "space-between", gap: story ? 110 * k : 0, borderTop: `${14 * k}px solid ${m.accentColor}` }}>
      <div style={{ display: "flex", marginTop: 20 * k }}>{print((story ? 860 : 490) * k, -3)}</div>
      <div style={{ ...flexRow, width: w - pad * 2, justifyContent: "space-between", alignItems: "flex-end" }}>
        {details(w - pad * 2 - (m.showQr && c.qr ? 200 * k : 0), false)}
        <div style={{ ...flexCol, alignItems: "flex-end", gap: 14 * k }}>
          <Qr c={c} size={(story ? 170 : 140) * k} dark />
          <JachaiMark c={c} size={24 * k} color={m.accentColor} />
        </div>
      </div>
    </div>
  );
}

const TEMPLATES: Record<PromoTemplateKey, (c: Ctx) => ReactNode> = {
  OFFER_BOLD: OfferBold,
  MENU_HIGHLIGHT: MenuHighlight,
  MINIMAL: Minimal,
  EVENT_POSTER: EventPoster,
  RATING_SHOWCASE: RatingShowcase,
  CUSTOM: Custom,
  SPLIT_PHOTO: SplitPhoto,
  PRICE_SPOTLIGHT: PriceSpotlight,
  FESTIVE: Festive,
  BIG_ANNOUNCEMENT: BigAnnouncement,
  LUXE: Luxe,
  MAGAZINE: Magazine,
  GLASS: Glass,
  POLAROID: Polaroid,
};

/**
 * The creative itself. `shape` is only passed on the server (HarfBuzz); in the browser text is native.
 * `showExpired`: overlay "EXPIRED" when the model says the offer ended (share page / OG image).
 */
export function PromoCreative({
  model,
  format,
  qrDataUrl,
  showExpired = false,
  shape,
}: {
  model: PromoRenderModel;
  format: CreativeFormat;
  qrDataUrl?: string | null;
  showExpired?: boolean;
  shape?: Shaper;
}) {
  const { width, height } = FORMAT_SIZE[format];
  const c: Ctx = { m: model, format, w: width, h: height, u: width / 1080, lang: creativeLang(model), qr: qrDataUrl, shape };
  const Template = TEMPLATES[model.templateKey] ?? Minimal;
  return (
    <div style={{ display: "flex", position: "relative", width, height, overflow: "hidden", fontFamily: PROMO_FONT_FAMILY, background: "#FFFFFF" }}>
      {Template(c)}
      {showExpired && model.expired && <ExpiredBand c={c} />}
    </div>
  );
}

/** Sample data for the admin template previews and the rendering test matrix. */
export function sampleModel(key: PromoTemplateKey, lang: "bn" | "en", variant: "normal" | "long" | "bare" = "normal"): PromoRenderModel {
  const bn = lang === "bn";
  const long = variant === "long";
  const bare = variant === "bare";
  const inAWeek = new Date(Date.now() + 7 * 86400000).toISOString();
  return {
    templateKey: key,
    businessName: long
      ? bn ? "ঢাকা শুক্রবার স্পেশাল কাচ্চি বিরিয়ানি অ্যান্ড গ্রিল হাউস লিমিটেড" : "The Very Long Named Dhanmondi Kacchi Biryani & Grill House Limited"
      : bn ? "রহমান বিরিয়ানি" : "Rahman Biryani",
    logoUrl: null,
    areaName: bn ? "মিরপুর" : "Mirpur",
    cityName: bn ? "ঢাকা" : "Dhaka",
    averageRating: bare ? null : 4.2,
    reviewCount: bare ? 0 : 128,
    quote: bare ? null : { text: bn ? "কাচ্চিটা অসাধারণ, মাংস একদম নরম আর পরিমাণেও যথেষ্ট।" : "The kacchi was amazing — tender meat and generous portions.", firstName: bn ? "তানভীর" : "Tanvir", rating: 5 },
    headline: long
      ? bn ? "শুক্রবার স্পেশাল: ক্ষীর আর কাচ্চি একসাথে, সন্ধ্যা থেকে রাত পর্যন্ত" : "Friday special: kacchi and firni together, evening to late night"
      : bn ? "শুক্রবারের বিশেষ অফার" : "Friday special",
    subline: bn ? "স্বাস্থ্যকর রান্না, প্রতিদিন তাজা — সন্ত্রাসমুক্ত পরিবেশে" : "Cooked fresh every day, in the heart of Mirpur",
    accentColor: "#C8102E",
    photoUrl: null,
    showRating: !bare,
    showQr: !bare,
    showPrice: true,
    offer: ["OFFER_BOLD", "MENU_HIGHLIGHT", "PRICE_SPOTLIGHT", "FESTIVE", "MAGAZINE", "GLASS", "LUXE"].includes(key)
      ? { title: bn ? "কাচ্চি ১টা কিনলে ১টা ফ্রি" : "Kacchi Buy 1 Get 1", headlineText: "BUY 1 GET 1", originalPrice: 560, offerPrice: 450, validUntil: inAWeek, active: true }
      : null,
    menuItem: ["MENU_HIGHLIGHT", "OFFER_BOLD", "PRICE_SPOTLIGHT", "LUXE", "MAGAZINE", "GLASS", "POLAROID"].includes(key)
      ? { name: long ? (bn ? "স্পেশাল কাচ্চি বিরিয়ানি উইথ বোরহানি অ্যান্ড ফিরনি (হাফ প্লেট)" : "Special Kacchi Biryani with Borhani and Firni (Half Plate)") : bn ? "কাচ্চি বিরিয়ানি (হাফ)" : "Kacchi Biryani (Half)", price: 450, priceText: null, photoUrl: null }
      : null,
    event: key === "EVENT_POSTER" ? { title: bn ? "শুক্রবার লাইভ গ্রিল নাইট" : "Friday Live Grill Night", start: inAWeek, end: null, location: bn ? "মিরপুর ১০, ঢাকা" : "Mirpur 10, Dhaka" } : null,
    shareUrl: "https://jachai.app/business/sample",
    expired: false,
    imageFit: "FIT",
  };
}
