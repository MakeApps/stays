import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Condo photos and receipts are served by the API behind a signed URL, so
    // they are proxied rather than fetched by the browser from object storage.
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/api/v1/files/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/api/v1/files/**" },
    ],
  },
  env: { API_ORIGIN },
  experimental: { typedRoutes: true },
};

export default nextConfig;
