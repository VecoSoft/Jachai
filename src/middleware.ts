import { NextResponse, type NextRequest } from "next/server";

// A listing merged into another keeps its old URL working: /business/{oldSlug} answers a real
// 301 to the kept listing, so search engines and shared links move over. The lookup is a tiny
// public API call, cached per server instance for a few minutes (hits and misses alike).

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8085").replace(/\/$/, "");
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { target: string | null; at: number }>();

async function redirectTarget(slug: string): Promise<string | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.target;
  let target: string | null = null;
  try {
    const res = await fetch(`${API}/api/v1/businesses/slug-redirects/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 200) {
      const body = (await res.json()) as { slug?: string };
      target = body.slug && body.slug !== slug ? body.slug : null;
    }
  } catch {
    return null; // API down or slow — let the page load normally (it also follows the API's 301)
  }
  if (cache.size > 2000) cache.clear();
  cache.set(slug, { target, at: Date.now() });
  return target;
}

export async function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/business\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();
  const slug = decodeURIComponent(match[1]);
  const target = await redirectTarget(slug);
  if (!target) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/business/${target}`;
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: "/business/:slug",
};
