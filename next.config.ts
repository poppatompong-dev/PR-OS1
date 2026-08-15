import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attachment uploads go through a Server Action; the default 1 MB body cap
    // would reject files long before the 10 MB bucket limit in migration 0010.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
