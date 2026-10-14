import type { NextConfig } from "next";

// The browser talks to the API through this same-origin path; Next reverse-
// proxies it to the real backend. Keeping the API same-origin means the
// httpOnly refresh cookie is first-party, so it survives a page reload (and
// CORS/SameSite stop mattering) no matter how the app is reached — localhost,
// a LAN IP, or a prod domain. Set BACKEND_ORIGIN per environment.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  images: {
    // Country flags for the onboarding country picker.
    remotePatterns: [{ protocol: "https", hostname: "flagcdn.com" }],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
