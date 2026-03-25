import type { NextConfig } from "next";

// vercel.live siempre permitido (Vercel lo inyecta en previews; en prod no se carga)
const scriptSrcValue = "'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.ar https://vercel.live";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrcValue}`,
  `script-src-elem ${scriptSrcValue}`,
  `script-src-attr ${scriptSrcValue}`,
  `worker-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: https://api.mercadopago.com https://auth.mercadopago.com https://vercel.live wss://vercel.live",
  "frame-src https://www.mercadopago.com https://www.mercadopago.com.ar https://www.youtube.com https://www.youtube-nocookie.com https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.ar",
  "frame-ancestors *",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
      },
      // Cloudflare R2 - permite cualquier cuenta de R2
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      // Cloudflare R2 Public Development URL
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
