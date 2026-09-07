import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate browser checks from an already-running local development server.
  distDir: process.env.DAVO_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" }
    ] }];
  },
};
export default nextConfig;
