// Hosts next/image may load from. Our own only: an open "**" pattern would let anyone use the
// Vercel image optimizer as a free proxy (billed to us). Stored photo URLs point at the API
// (/api/v1/storage/files/...), which checks moderation and then redirects to a short-lived
// presigned Spaces URL; media.jachai.com and the Spaces CDN host serve public assets directly.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8085");
const imageHosts = [
  { protocol: apiUrl.protocol.replace(":", ""), hostname: apiUrl.hostname, ...(apiUrl.port ? { port: apiUrl.port } : {}) },
  { protocol: "https", hostname: "api.jachai.com" },
  { protocol: "https", hostname: "media.jachai.com" },
  { protocol: "https", hostname: "jachai-media.sgp1.cdn.digitaloceanspaces.com" },
  { protocol: "https", hostname: "jachai-media.sgp1.digitaloceanspaces.com" },
  // Profile photos of accounts created with Google Sign-In
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  // Local development
  { protocol: "http", hostname: "localhost", port: "8085" },
  { protocol: "http", hostname: "127.0.0.1", port: "8085" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Creative PNG rendering (src/lib/promo-render.tsx) uses a native rasterizer and a WASM text
  // shaper — load them with Node's require instead of bundling them.
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "harfbuzzjs", "satori"],
  },
  images: {
    remotePatterns: imageHosts,
  },
  // NID (national ID) verification is feature-flagged off (backend features.nid-verification.enabled,
  // admin-overridable). The app has no NID screens; any old NID link lands on /account instead of a 404.
  async redirects() {
    return [
      { source: "/nid", destination: "/account", permanent: false },
      { source: "/nid/:path*", destination: "/account", permanent: false },
      { source: "/nid-verification/:path*", destination: "/account", permanent: false },
      { source: "/nid-verifications/:path*", destination: "/account", permanent: false },
      { source: "/account/nid", destination: "/account", permanent: false },
      { source: "/account/nid/:path*", destination: "/account", permanent: false },
      { source: "/admin/nid-queue", destination: "/account", permanent: false },
    ];
  },
};

export default nextConfig;
