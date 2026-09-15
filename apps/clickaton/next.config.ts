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
    /*
     * El motor que dibuja las placas de participante.
     *
     * Hay que nombrarlo a mano porque el bloque `webpack` de más abajo lo saca del empaquetado
     * para que se cargue en tiempo de ejecución, y lo que se saca del empaquetado deja de ser
     * rastreado: Next no lo sube al servidor y en producción falla con "Cannot find module".
     * El binario de `@napi-rs/canvas` viene en un paquete distinto por sistema operativo —en
     * Vercel, Linux—, así que se incluyen todas sus variantes y no la del equipo donde se
     * desarrolla.
     *
     * Va ruta por ruta y no en `/**`: pesa unas decenas de megas y Next lo copia una vez por
     * función. Aplicado a todas, el contenedor de build se queda sin disco.
     *
     * Copiar los archivos no alcanza por sí solo: el `require` se ejecuta desde el bundle de
     * esta app, y con pnpm el paquete cuelga de `packages/design-studio/node_modules`, donde
     * Node no lo busca. Por eso además figura en las dependencias de esta app —que es lo que
     * crea el enlace en `apps/clickaton/node_modules` y lo vuelve resoluble.
     */
    ...Object.fromEntries(
      [
        "/api/cron/participant-cards",
        "/api/account/registrations/[registrationId]/cards/[cardType]",
        "/api/admin/registrations/[registrationId]/cards/[cardType]",
        // Generan la placa apenas se confirma el pago, vía `after()`.
        "/api/webhooks/dnx-payments",
        "/api/cron/payments-reconciliation",
      ].map((ruta) => [
        ruta,
        [
          "../../node_modules/.pnpm/pdf-to-png-converter@*/node_modules/pdf-to-png-converter/**",
          /*
           * Todo el árbol de `@napi-rs/canvas`, no sólo la carpeta `canvas`: el binario vive en
           * un paquete aparte por sistema operativo y se alcanza por un enlace que cuelga al
           * lado (`@napi-rs/canvas-linux-x64-gnu`). Copiando sólo `canvas/**` el módulo carga y
           * después muere con "Cannot find native binding".
           */
          "../../node_modules/.pnpm/@napi-rs+canvas*/**",
          /*
           * La variante de Linux nombrada sin comodín. El patrón de arriba debería alcanzar,
           * pero el binario seguía sin llegar al servidor y un comodín que no matchea no avisa:
           * simplemente no copia nada. Vercel corre Linux x64 con glibc.
           */
          "../../node_modules/.pnpm/@napi-rs+canvas-linux-x64-gnu@*/node_modules/@napi-rs/canvas-linux-x64-gnu/**",
          /*
           * `pdfjs` carga su worker en tiempo de ejecución armando la ruta con una cadena, así
           * que el rastreo de Next no lo ve y en el servidor falta: "Setting up fake worker
           * failed". Sólo los `.mjs` de `legacy/build`, que son 6 MB; el paquete entero pesa 37
           * por los mapas de depuración, que acá no sirven para nada.
           */
          "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/*.mjs",
          "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/package.json",
          /*
           * `pdfjs` carga el canvas con `createRequire(import.meta.url)`, o sea que lo busca
           * **desde su propia carpeta**. Con pnpm eso se resuelve por el enlace que vive al
           * lado suyo, y hay que copiarlo aparte: sin él el módulo está en el servidor pero
           * pdfjs no lo encuentra ("Cannot find module '@napi-rs/canvas'").
           */
          "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/@napi-rs/**",
        ],
      ])
    ),
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
