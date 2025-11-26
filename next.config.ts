import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE_OUTPUT === 'true' ? 'standalone' : undefined,
  /* config options here */
};

export default nextConfig;
