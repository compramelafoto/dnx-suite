import type { NextConfig } from "next";

// vercel.live siempre permitido (Vercel lo inyecta en previews; en prod no se carga)
const scriptSrcValue =
  "'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.ar https://vercel.live";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrcValue}`,
  `script-src-elem ${scriptSrcValue}`,
  `script-src-attr ${scriptSrcValue}`,
  `worker-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: https://api.mercadopago.com https://auth.mercadopago.com https://vercel.live wss://vercel.live",
  "frame-src https://www.mercadopago.com https://www.mercadopago.com.ar https://www.youtube.com https://www.youtube-nocookie.com https://vercel.live https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.ar",
  "frame-ancestors *",
  "font-src 'self' https://fonts.gstatic.com data:",
].join("; ");

/** Evita que el trace de `/api/photos/[id]/view` empaquete assets estáticos pesados (límite Vercel 250 MB). */
const photoViewTraceExcludes = [
  "./data/**",
  "./public/**",
  "./docs/**",
  "./scripts/**",
  "./visual-checks/**",
  "./app/lab/**",
  "./*.md",
  "./**/*.md",
  "node_modules/@swc/**",
  "node_modules/@esbuild/**",
  "node_modules/terser/**",
  "node_modules/webpack/**",
  "node_modules/@img/sharp-libvips-linuxmusl-x64/**",
  "node_modules/@img/sharp-linuxmusl-x64/**",
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/db",
    "@repo/auth",
    "@repo/auth-guards",
    "@repo/design-system",
    "@repo/cuanto-cobro-core",
  ],
  serverExternalPackages: ["sharp", "sanitize-html"],
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/organizadores",
        destination: "/organizador",
        permanent: true,
      },
      {
        source: "/Organizadores",
        destination: "/organizador",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/fotografoescolar",
        destination: "/land/fotografo-escolar",
      },
      {
        source: "/escuelas",
        destination: "/land/escuelas-leads",
      },
      {
        source: "/Escuelas",
        destination: "/land/escuelas-leads",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/photos/**": ["./assets/fonts/Roboto-Regular.ttf", "./assets/watermark.png"],
  },
  outputFileTracingExcludes: {
    "/api/photos/**": photoViewTraceExcludes,
    "/api/**": ["./data/**", "./public/**", "./visual-checks/**", "./*.md", "./**/*.md"],
  },
};

export default nextConfig;
