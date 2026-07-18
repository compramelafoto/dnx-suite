import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config aislada para tests de dominio de ¿Cuánto Cobro?
 * Usa Vitest ya presente en el monorepo (@dnx/dnx-mcp) sin alterar fórmulas.
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
    include: ["lib/cuantocobro/**/*.{test,characterization.test}.ts"],
  },
});
