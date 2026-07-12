import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes compartidos del monorepo (mismo patrón que compramelafoto / fotoffice).
  transpilePackages: ["@repo/db", "@repo/auth", "@repo/design-system", "@repo/editor"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
    ],
  },
};

export default nextConfig;
