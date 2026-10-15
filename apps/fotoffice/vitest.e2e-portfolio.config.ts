import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Configuración SOLO para la verificación de punta a punta contra una base de prueba local.
 *
 * Separada de `vitest.config.ts` a propósito: la batería normal no puede depender de que haya una
 * base levantada. Esto se corre a mano, con `DATABASE_URL` apuntando a la base descartable.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/e2e-portfolio/verificar.test.ts"],
    // Las comprobaciones se pisan entre sí (bajan, reactivan, apagan el módulo): van en orden.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
