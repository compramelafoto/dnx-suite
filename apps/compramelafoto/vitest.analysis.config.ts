import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config aislada para los tests del pipeline de análisis (face/OCR).
 * Usa el Vitest ya presente en el monorepo, igual que `vitest.cuantocobro.config.ts`.
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
    include: ["lib/analysis/**/*.test.ts"],
  },
});
