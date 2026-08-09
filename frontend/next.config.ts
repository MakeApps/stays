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
  typedRoutes: true,
  // Off, not merely moved. The dev badge is a fixed bottom-corner overlay and
  // the mobile bottom tab bar now spans the full width, so every corner it
  // could sit in covers a navigation tab — and on desktop bottom-left covered
  // the collapsed rail's sign-out button. Production never had it; this makes
  // local testing match. Build state is still in the terminal.
  devIndicators: false,
};

export default nextConfig;
