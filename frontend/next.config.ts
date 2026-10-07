import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Country flags for the onboarding country picker.
    remotePatterns: [{ protocol: "https", hostname: "flagcdn.com" }],
  },
};

export default nextConfig;
