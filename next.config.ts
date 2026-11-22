import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos arrive under 4 MB (the browser shrinks them first); the rest is
    // room for the form fields. Vercel rejects bodies over 4.5 MB, so this is
    // 4,500,000 bytes exactly ("4.5mb" would be 4,718,592, slightly over).
    serverActions: { bodySizeLimit: 4_500_000 },
  },
};

export default nextConfig;
