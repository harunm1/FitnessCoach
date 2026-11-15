import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos arrive under 4 MB (the browser shrinks them first); the rest is
    // room for the form fields. Vercel rejects anything over 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
