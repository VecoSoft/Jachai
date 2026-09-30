/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
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
