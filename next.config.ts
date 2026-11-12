import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Progress photos are up to 10 MB; the rest is room for the form fields.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
