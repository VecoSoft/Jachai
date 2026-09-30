import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { PromoSharePayload } from "@/lib/types";
import { SharePageClient } from "./share-page-client";

/**
 * Public share page for a business post (V58): /p/<postId>?ref=wa|fb|share|promo_<creativeId>.
 * Server-rendered so link previews (WhatsApp / Facebook / X) get real OG/Twitter meta: the image is
 * the live OG creative (/api/promo/og/<postId>, "Expired" overlay once the offer ends), the title
 * is the business name + headline, and the description is the caption.
 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8085";

async function load(postId: string): Promise<PromoSharePayload | null> {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null;
  const res = await fetch(`${API}/api/v1/promo/public/posts/${postId}/share`, { cache: "no-store" });
  return res.ok ? ((await res.json()) as PromoSharePayload) : null;
}

function origin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function clip(s: string | null | undefined, max: number) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return Array.from(t).length > max ? Array.from(t).slice(0, max - 1).join("") + "…" : t;
}

export async function generateMetadata({ params }: { params: { postId: string } }): Promise<Metadata> {
  const share = await load(params.postId);
  if (!share) return { title: "Jachai" };
  const headline = share.creative?.headline ?? share.post.title ?? "";
  const title = headline ? `${share.business.name} — ${clip(headline, 60)}` : share.business.name;
  const description = clip(share.post.body, 200) || `${share.business.name} on Jachai`;
  const image = `${origin()}/api/promo/og/${params.postId}`;
  return {
    title,
    description,
    alternates: { canonical: `${origin()}/p/${params.postId}` },
    openGraph: { type: "article", title, description, url: `${origin()}/p/${params.postId}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params }: { params: { postId: string } }) {
  const share = await load(params.postId);
  if (!share) notFound();
  return <SharePageClient share={share} />;
}
