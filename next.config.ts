import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  generateBuildId: async () => process.env.KOONPINAI_BUILD_ID ?? null,
  devIndicators: false,
  // Callback query strings and Server Action arguments contain private data.
  logging: false,
  async headers() {
    return [
      {
        source: "/api/auth/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  // Keep fictional browser regressions separate from the real app's output.
  distDir: process.env.KOONPINAI_E2E === "true" ? ".next-e2e" : ".next",
};
export default nextConfig;
