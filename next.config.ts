import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/chrono100-v10.html",
      },
    ];
  },
};

export default nextConfig;
