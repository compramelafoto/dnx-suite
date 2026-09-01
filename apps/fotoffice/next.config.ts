import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // @repo/db NO se transpila: se externaliza para conservar el Query Engine de Prisma.
  // Mismo criterio que apps/clickaton. Transpilarlo funcionaba con Turbopack, pero con
  // webpack el motor nativo no llega al bundle y toda consulta falla en runtime.
  transpilePackages: ["@repo/auth", "@repo/auth-ui", "@repo/payments", "@repo/design-studio"],
  serverExternalPackages: [
    "@prisma/client",
    "@repo/db",
    // Binario nativo del rasterizado de PDF: si webpack intenta empaquetarlo, falla el build.
    "pdf-to-png-converter",
    "@napi-rs/canvas",
    // El renderer de plantillas levanta un navegador para la vista previa. Playwright trae
    // assets HTML que webpack no sabe empaquetar, y no hace falta: corre siempre en el servidor.
    "playwright",
    "playwright-core",
  ],
  outputFileTracingRoot: path.join(appDir, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
      // Las tipografías ya no se leen del disco: viajan incrustadas en @repo/design-studio.
      // Antes se copiaban acá y aun así fallaban en el servidor — con pnpm el enlace a
      // @fontsource vive dentro de packages/design-studio, y el código empaquetado termina en
      // otro lado del árbol, donde la búsqueda hacia arriba nunca llega. Copiar los archivos no
      // alcanzaba: el problema no era que faltaran, era que Node no sabía dónde buscarlos.
    ],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  // @repo/payments usa imports ESM con extensión .js apuntando a fuentes .ts.
  // Mismo criterio que apps/clickaton, que consume el mismo paquete.
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

    if (isServer) {
      // `serverExternalPackages` no alcanza acá: el import dinámico de pdf-to-png-converter
      // vive DENTRO de @repo/design-studio, que sí se transpila, así que webpack lo resuelve
      // y termina intentando empaquetar el binario nativo de skia. Externalizarlo a mano es
      // lo que lo deja fuera del grafo.
      //
      // FotoOffice NO rasteriza: el carnet solo pide PDF (ver lib/carnet/render.ts). Esto
      // existe para que el código del módulo de diseño no rompa la compilación, no para
      // habilitar el rasterizado. Si alguna vez hace falta, hay que resolver además que el
      // binario nativo llegue al paquete desplegado, que es de otra plataforma.
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals];
      config.externals = [
        ...externals.filter(Boolean),
        ({ request }: { request?: string }, callback: (err?: unknown, result?: string) => void) => {
          if (
            request === "pdf-to-png-converter" ||
            request === "@napi-rs/canvas" ||
            request?.startsWith("@napi-rs/canvas-") ||
            // Mismo caso: el import de Playwright vive DENTRO de
            // @repo/template-engine-renderer, que se transpila. Playwright trae assets HTML
            // del inspector que webpack no sabe leer, y no hace falta empaquetarlos: la vista
            // previa de plantillas corre siempre en el servidor.
            request === "playwright" ||
            request === "playwright-core" ||
            request?.startsWith("playwright-core/")
          ) {
            return callback(undefined, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }

    return config;
  },
  turbopack: {
    // Silencia detección errónea de root por lockfiles fuera del monorepo.
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
