import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bw/config"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
