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
  ],
  outputFileTracingRoot: path.join(appDir, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
      // @repo/design-studio abre los .woff armando la ruta en tiempo de ejecución, así que
      // el rastreador de Next no la ve y no los copia. Sin esto, en local anda y en Vercel
      // falla al emitir el primer carnet.
      //
      // Se listan las seis familias del catálogo, y solo el subconjunto latino: un patrón
      // abierto sobre @fontsource arrastraría las 20 familias que tiene fotorank en el
      // monorepo —30 MB— a todas las rutas de esta aplicación.
      "../../node_modules/.pnpm/@fontsource+dm-sans@*/node_modules/@fontsource/dm-sans/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+inter@*/node_modules/@fontsource/inter/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+playfair-display@*/node_modules/@fontsource/playfair-display/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+merriweather@*/node_modules/@fontsource/merriweather/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+cinzel@*/node_modules/@fontsource/cinzel/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+great-vibes@*/node_modules/@fontsource/great-vibes/files/*-latin-*.woff",
    ],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  // @repo/payments usa imports ESM con extensión .js apuntando a fuentes .ts.
  // Mismo criterio que apps/clickaton, que consume el mismo paquete.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  turbopack: {
    // Silencia detección errónea de root por lockfiles fuera del monorepo.
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
