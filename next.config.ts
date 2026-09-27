import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Standalone concept page for Sarah Jane (static file in public/)
      { source: "/sj-venture-studio", destination: "/sj-venture-studio.html" },
    ];
  },
};

export default nextConfig;
