import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@woodshed/ui", "@woodshed/shared-types"],
};

export default nextConfig;
