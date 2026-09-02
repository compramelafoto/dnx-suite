import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const monorepoRoot = path.join(appDir, "../..");

/** CSP for Card Payment Brick / MercadoPago.js — official origins only (no wildcards). */
const clickatonCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.ar https://http2.mlstatic.com https://vercel.live",
  "script-src-elem 'self' 'unsafe-inline' https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.ar https://http2.mlstatic.com https://vercel.live",
  "connect-src 'self' https://api.mercadopago.com https://api.mercadolibre.com https://www.mercadopago.com https://www.mercadopago.com.ar https://events.mercadopago.com https://sdk.mercadopago.com https://http2.mlstatic.com https://vercel.live wss://vercel.live",
  "frame-src https://www.mercadopago.com https://www.mercadopago.com.ar https://sdk.mercadopago.com https://http2.mlstatic.com https://vercel.live",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.ar",
].join("; ");

type ExternalCallback = (err?: Error | null, result?: string) => void;

const nextConfig: NextConfig = {
  // Portadas de edición permiten hasta 8 MB; default de Server Actions es 1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // @repo/db se externaliza (no transpile) para conservar el Query Engine de Prisma.
  transpilePackages: [
    "@repo/auth",
    "@repo/content",
    "@repo/content-ui",
    "@repo/payments",
    "@repo/template-editor-core",
    "@repo/template-editor-ui",
    "@mercadopago/sdk-react",
  ],
  // Evita que el bundler omita el Query Engine de Prisma en Vercel (rhel-openssl-3.0.x).
  // `pdf-to-png-converter` arrastra el binario nativo de `@napi-rs/canvas`.
  // Webpack no puede empaquetar un .node: hay que dejarlo como dependencia externa.
  serverExternalPackages: [
    "@prisma/client",
    "@repo/db",
    "@napi-rs/canvas",
    "pdf-to-png-converter",
  ],
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    // Silencia detección errónea de root por lockfiles fuera del monorepo.
    root: monorepoRoot,
  },
  // @repo/payments usa imports ESM con extensión .js apuntando a fuentes .ts.
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

    // `pdf-to-png-converter` arrastra el binario nativo de `@napi-rs/canvas`, que
    // webpack no puede empaquetar (`Module parse failed` sobre un .node).
    // `serverExternalPackages` no alcanza: el import nace dentro de un paquete del
    // workspace (@repo/template-editor-core → design-studio), no dentro de
    // node_modules, y Next no lo externaliza. Se resuelve en tiempo de ejecución
    // con require de Node.
    if (isServer) {
      const previos = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      config.externals = [
        ...previos,
        ({ request }: { request?: string }, callback: ExternalCallback) => {
          if (
            request === "pdf-to-png-converter" ||
            request === "@napi-rs/canvas" ||
            request?.endsWith(".node")
          ) {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: clickatonCsp }],
      },
    ];
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
      {
        source: "/nosotros",
        destination: "/sobre",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
