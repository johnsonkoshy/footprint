import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright ships its own binaries and must not be bundled into the route.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
