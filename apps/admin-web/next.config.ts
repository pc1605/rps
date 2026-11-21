import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (apps/admin-web/Dockerfile): a self-contained server with only the files it needs.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@rps/shared"],
};

export default nextConfig;
