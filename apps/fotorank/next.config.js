/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * pdf-to-png-converter → @napi-rs/canvas (binarios nativos). Turbopack no puede empaquetarlos;
   * deben resolverse en runtime con require en Node (Vercel incluye el paquete en node_modules).
   */
  serverExternalPackages: ["pdf-to-png-converter", "@napi-rs/canvas"],
  /** Playwright y otros clientes que usan 127.0.0.1 necesitan HMR; sin esto Next 16 bloquea el bundle y no hidrata. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
