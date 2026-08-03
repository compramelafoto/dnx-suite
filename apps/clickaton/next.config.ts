import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/db", "@repo/auth", "@repo/payments"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    // Silencia detección errónea de root por lockfiles fuera del monorepo.
    root: monorepoRoot,
  },
  // @repo/payments usa imports ESM con extensión .js apuntando a fuentes .ts.
  // Turbopack (default en Next 16) ignora webpack(); el script build usa --webpack.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  async redirects() {
    return [
      {
        source: "/organizar-sede",
        destination: "/organizar",
        permanent: true,
      },
      {
        source: "/sponsors",
        destination: "/formar-parte",
        permanent: true,
      },
      {
        source: "/aliados-fundadores",
        destination: "/formar-parte",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
