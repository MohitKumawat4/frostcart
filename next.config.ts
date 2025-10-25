import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permit fetching remote placeholder images from Unsplash during development.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
