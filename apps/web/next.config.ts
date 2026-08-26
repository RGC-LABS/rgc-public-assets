import type { NextConfig } from "next";

const config: NextConfig = {
  // Detail-panel previews come from the pinned CDN, resized by Vercel.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.jsdelivr.net" }],
  },
  // The convention is the plural; catch the singular rather than 404 on it.
  async redirects() {
    return [{ source: "/llm.txt", destination: "/llms.txt", permanent: true }];
  },
};

export default config;
