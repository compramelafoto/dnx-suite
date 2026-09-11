import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // @repo/db no se transpila: se externaliza para conservar el Query Engine de Prisma.
  // Mismo criterio que fotoffice y clickaton — con webpack, el motor nativo no llega al
  // bundle si se transpila, y toda consulta falla en runtime.
  serverExternalPackages: ["@prisma/client", "@repo/db"],
  outputFileTracingRoot: path.join(appDir, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
  },
  turbopack: {
    // Silencia la detección errónea de root por lockfiles fuera del monorepo.
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
