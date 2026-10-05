import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, "../..");

const nextConfig: NextConfig = {
  /**
   * pdf-to-png-converter → @napi-rs/canvas (binarios nativos). Turbopack no puede empaquetarlos;
   * deben resolverse en runtime con require en Node (Vercel incluye el paquete en node_modules).
   */
  serverExternalPackages: [
    "pdf-to-png-converter",
    "@napi-rs/canvas",
    "@prisma/client",
    "@repo/db",
  ],
  transpilePackages: ["@repo/auth", "@repo/jury-ranking", "@repo/payments"],
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
  },
  /**
   * Lo que el `include` de arriba arrastra y nadie usa al ejecutar. Sin esto, la función de
   * diplomas pasó el límite de 250 MB de Vercel cuando el esquema compartido sumó la tienda de
   * FOTOFFICE: sólo `index.d.ts` del cliente de Prisma pesa ~79 MB (son tipos, no código), y las
   * migraciones son SQL que se aplica a mano, nunca desde la app.
   */
  outputFileTracingExcludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*.d.ts",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*.d.ts",
      "../../packages/db/prisma/migrations/**",
      "../../packages/db/prisma/migrations_legacy_backup/**",
    ],
  },
  /** Playwright y otros clientes que usan 127.0.0.1 necesitan HMR; sin esto Next 16 bloquea el bundle y no hidrata. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: monorepoRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
