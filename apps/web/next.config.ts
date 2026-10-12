import type { NextConfig } from "next";

/**
 * API_INTERNAL_URL is set only when the web app and the API live on different sites and no custom
 * domain is available yet (staging). The browser then calls /api/v1/... on the web site itself and
 * Next forwards it to the API, so the session cookie stays first party. Leave it unset locally.
 */
const apiInternal = (process.env.API_INTERNAL_URL ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@bw/config"],
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return apiInternal ? [{ source: "/api/v1/:path*", destination: `${apiInternal}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
