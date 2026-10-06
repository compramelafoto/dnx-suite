import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Los tipos NO se chequean en el build de Vercel: el 05/10/2026 ese paso se quedó sin memoria y
  // mató el deploy de producción (PR #368), aunque el código compilaba. Se chequean en GitHub
  // Actions (`.github/workflows/chequeos.yml`, «Chequear tipos de FOTOFFICE»), que frena el PR
  // antes del merge. Mismo criterio que CompraMeLaFoto y Clickatón.
  // Si alguna vez se saca ese paso del workflow, hay que volver a prender esto.
  typescript: {
    ignoreBuildErrors: true,
  },
  // @repo/db NO se transpila: se externaliza para conservar el Query Engine de Prisma.
  // Mismo criterio que apps/clickaton. Transpilarlo funcionaba con Turbopack, pero con
  // webpack el motor nativo no llega al bundle y toda consulta falla en runtime.
  transpilePackages: [
    "@repo/quick-search",
    "@repo/auth",
    "@repo/auth-ui",
    // El blog de cada institución: el motor compartido y su editor (los mismos de CLF y Clickatón).
    "@repo/content",
    "@repo/content-ui",
    "@repo/payments",
    "@repo/design-studio",
    // Sólo el selector de logos de los aliados de los sorteos (`lib/raffles/partners-live.ts`).
    "@repo/partners",
  ],
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
    /*
     * Las placas de Comunicación (`lib/placas/render.ts`) se rasterizan con `mupdf`, que es
     * WebAssembly: un solo archivo igual para todos los sistemas, sin variante por plataforma
     * (por eso, a diferencia del binario nativo de arriba, sí se puede usar en Vercel). Webpack
     * no sabe empaquetar su `.wasm` de 10 MB; lo carga Node en tiempo de ejecución.
     * `sharp` convierte las fotos WebP de los socios, que `mupdf` no lee.
     */
    "mupdf",
    "sharp",
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
    /*
     * El motor de rasterizado de las placas. Va sólo en la ruta que dibuja y no en `/**`: el
     * `.wasm` pesa 10 MB y Next lo copia una vez por función; aplicado a todas, el contenedor de
     * build se queda sin disco (pasó en Clickatón). Se excluyen los `.br`, que Node no usa.
     */
    "/api/comunicacion/placas/[memberId]/[kind]/[format]": [
      "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/dist/*.js",
      "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/dist/*.wasm",
      "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/package.json",
    ],
  },
  // La página de un pedido de la tienda se abre con un token en la dirección (la vuelta de
  // Mercado Pago, los correos): no se manda esa dirección a ningún sitio que se abra desde ahí.
  // Dos formas porque en el dominio propio de la institución la tienda vive en `/tienda`.
  async headers() {
    const noReferrer = [{ key: "Referrer-Policy", value: "no-referrer" }];
    return [
      { source: "/w/:slug/tienda/pedido/:path*", headers: noReferrer },
      { source: "/tienda/pedido/:path*", headers: noReferrer },
    ];
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
      // El carnet sólo pide PDF (ver lib/carnet/render.ts). Las placas de Comunicación sí
      // rasterizan, pero con `mupdf` (WebAssembly), no con este binario nativo: esto existe para
      // que el código viejo del módulo de diseño no rompa la compilación.
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
          // Mismo caso con `mupdf`: su import vive DENTRO de @repo/design-studio. Es ESM con
          // `await` en el nivel superior, así que no se puede cargar con `require`: va como
          // `import()` nativo, que es lo que el módulo ya hace.
          if (request === "mupdf") {
            return callback(undefined, "import mupdf");
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
