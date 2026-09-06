import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config aislada para los tests del permiso de difusión en redes sociales.
 * Usa el Vitest ya presente en el monorepo, igual que `vitest.analysis.config.ts`.
 */
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["lib/social/**/*.test.ts"],
  },
});
