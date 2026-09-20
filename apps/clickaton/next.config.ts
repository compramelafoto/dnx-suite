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
  // El bucket va acá porque la foto de una consigna se sube directo desde el
  // navegador: la plataforma corta en 4,5 MB el cuerpo de cualquier petición al
  // servidor, y una foto de cámara pesa más. Sin este permiso, el navegador
  // bloquea el envío antes de hacerlo y la entrega falla sin llegar a la red.
  "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.mercadopago.com https://api.mercadolibre.com https://www.mercadopago.com https://www.mercadopago.com.ar https://events.mercadopago.com https://sdk.mercadopago.com https://http2.mlstatic.com https://vercel.live wss://vercel.live",
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
  /*
   * `mupdf` es WebAssembly: webpack no puede empaquetar su `.wasm` de 10 MB, así que lo carga
   * Node en tiempo de ejecución. A diferencia de los binarios nativos que estuvieron antes acá,
   * es **un solo archivo igual para todos los sistemas**: no hay variante por plataforma.
   */
  serverExternalPackages: [
    "@prisma/client",
    "@repo/db",
    "mupdf",
  ],
  // El chequeo de tipos NO corre acá: `tsc` sobre esta app necesita más memoria
  // de la que tiene la máquina de Vercel y el build muere con SIGKILL por OOM,
  // aunque el código compile bien. Apagarlo no afloja el control, lo mueve: el
  // workflow `.github/workflows/chequeos.yml` corre `check-types` de Clickatón
  // en cada pull request contra main, así un error de tipos frena el merge en
  // vez de frenar el despliegue.
  //
  // Si alguna vez se saca ese paso del workflow, hay que volver a prender esto
  // o nadie estaría chequeando los tipos de Clickatón en ningún lado.
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
    /*
     * El motor de rasterizado. Va ruta por ruta y no en `/**`: el `.wasm` pesa 10 MB y Next lo
     * copia una vez por función; aplicado a todas, el contenedor de build se queda sin disco.
     * Se excluyen los `.br` —comprimidos, que Node no usa— y las declaraciones de tipos.
     */
    ...Object.fromEntries(
      [
        "/api/cron/participant-cards",
        "/api/account/registrations/[registrationId]/cards/[cardType]",
        "/api/admin/registrations/[registrationId]/cards/[cardType]",
        // Genera la placa apenas se confirma el pago, vía `after()`.
        "/api/webhooks/dnx-payments",
      ].map((ruta) => [
        ruta,
        [
          "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/dist/*.js",
          "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/dist/*.wasm",
          "../../node_modules/.pnpm/mupdf@*/node_modules/mupdf/package.json",
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
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

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
