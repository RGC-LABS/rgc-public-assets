import type { NextConfig } from "next";

const config: NextConfig = {
  // Detail-panel previews come from the pinned CDN, resized by Vercel.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.jsdelivr.net" }],
  },
};

export default config;
