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

export const TEMPLATE_KEYS: PromoTemplateKey[] = ["OFFER_BOLD", "MENU_HIGHLIGHT", "MINIMAL", "EVENT_POSTER", "RATING_SHOWCASE"];

export const PROMO_FONT_FAMILY = "Hind Siliguri";
const BRAND_RED = "#C8102E";
const INK = "#111827";
const MUTED = "#4B5563";

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
  },
  bn: {
    validUntil: (d: string) => `${d} পর্যন্ত`,
    orderOn: "Jachai-তে অর্ডার করুন",
    interested: "আগ্রহী? Jachai-তে জানান",
    reviews: (r: string, n: number) => `Jachai-তে ${n}টি রিভিউ থেকে ${r}`,
    newOn: "Jachai-তে নতুন",
    scan: "স্ক্যান করুন",
    expired: "মেয়াদ শেষ",
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

const TEMPLATES: Record<PromoTemplateKey, (c: Ctx) => ReactNode> = {
  OFFER_BOLD: OfferBold,
  MENU_HIGHLIGHT: MenuHighlight,
  MINIMAL: Minimal,
  EVENT_POSTER: EventPoster,
  RATING_SHOWCASE: RatingShowcase,
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
    offer: key === "OFFER_BOLD" || key === "MENU_HIGHLIGHT"
      ? { title: bn ? "কাচ্চি ১টা কিনলে ১টা ফ্রি" : "Kacchi Buy 1 Get 1", headlineText: "BUY 1 GET 1", originalPrice: 560, offerPrice: 450, validUntil: inAWeek, active: true }
      : null,
    menuItem: key === "MENU_HIGHLIGHT" || key === "OFFER_BOLD"
      ? { name: long ? (bn ? "স্পেশাল কাচ্চি বিরিয়ানি উইথ বোরহানি অ্যান্ড ফিরনি (হাফ প্লেট)" : "Special Kacchi Biryani with Borhani and Firni (Half Plate)") : bn ? "কাচ্চি বিরিয়ানি (হাফ)" : "Kacchi Biryani (Half)", price: 450, priceText: null, photoUrl: null }
      : null,
    event: key === "EVENT_POSTER" ? { title: bn ? "শুক্রবার লাইভ গ্রিল নাইট" : "Friday Live Grill Night", start: inAWeek, end: null, location: bn ? "মিরপুর ১০, ঢাকা" : "Mirpur 10, Dhaka" } : null,
    shareUrl: "https://jachai.app/business/sample",
    expired: false,
  };
}
