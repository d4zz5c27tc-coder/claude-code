import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard der Next.js-16-Vorlage: Seiten sind dynamisch, Caching nur per "use cache"
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
