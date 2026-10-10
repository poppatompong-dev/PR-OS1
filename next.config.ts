import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attachment uploads go through a Server Action; the default 1 MB body cap
    // would reject files long before the 10 MB bucket limit in migration 0010.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      {
        // A cached service worker is a service worker that can never be
        // replaced — the browser would keep serving the old one, and with it
        // the old cached pages, after every deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
