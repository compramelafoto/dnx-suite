/** @type {import('next').NextConfig} */
const nextConfig = {
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
