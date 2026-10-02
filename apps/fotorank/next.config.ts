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
  /**
   * Prisma en las funciones de Vercel: solo lo que Node necesita para ejecutar en Linux.
   *
   * Antes se incluían `.prisma/client/**` y `@prisma/client/**` enteros en todas las rutas. Eso
   * metía en cada función los tipos (`index.d.ts` ≈ 80 MB), el motor de macOS, las variantes
   * edge/wasm y `@prisma/client/runtime` completo (≈ 73 MB de wasm en base64 y source maps), y
   * "dashboard/concursos/[id]/diplomas" llegaba a 251 MB (tope: 250). Excluir después no
   * alcanzaba: el comodín `/**` del include volvía a agregar todo.
   *
   * Al ejecutar, la cadena es: `@prisma/client/default.js` → `.prisma/client/default.js` →
   * (`#main-entry-point`, condición `node`, declarada en su `package.json`) `index.js` →
   * `@prisma/client/runtime/library.js` + `libquery_engine-rhel-openssl-3.0.x.so.node`. El esquema
   * ya viaja dentro de `index.js`; `schema.prisma` se suma solo como respaldo (pesa < 1 MB).
   * Las migraciones no se usan en runtime: las corre el deploy, no el cliente.
   */
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*.js",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/package.json",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/schema.prisma",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/*.js",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/package.json",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/library.js",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/index-browser.js",
      "../../packages/db/prisma/schema.prisma",
    ],
  },
  /**
   * Segunda barrera, por si el rastreo automático de Next (o un include futuro) vuelve a sumar
   * lo que no corre en Linux: tipos, motores de macOS, variantes edge/wasm y source maps.
   */
  outputFileTracingExcludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*.d.ts",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-darwin*",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/query_engine_bg.wasm",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*.d.ts",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*.d.mts",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/*.map",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/*.wasm-base64.*",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/query_*",
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
