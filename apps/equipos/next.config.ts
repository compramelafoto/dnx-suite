import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // @repo/db no se transpila: se externaliza para conservar el Query Engine de Prisma.
  // Mismo criterio que fotoffice, clickaton y subilafoto.
  serverExternalPackages: ["@prisma/client", "@repo/db"],
  outputFileTracingRoot: path.join(appDir, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
  },
  experimental: {
    // Next limita por defecto el cuerpo de una Server Action a 1 MB. Fotos y comprobantes llegan
    // hasta 4 MB (el límite real lo valida lib/archivos.ts); el margen cubre el armado del form.
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    // Silencia la detección errónea de root por lockfiles fuera del monorepo.
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
