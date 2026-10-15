import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config aislada para los tests de cobros (pagos duplicados, links de pago de packs).
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
    include: [
      "lib/album-packs/album-pack-order-payable.test.ts",
      "lib/album-packs/album-pack-cart-storage.test.ts",
      "lib/mercadopago/duplicate-album-order-payment-rules.test.ts",
      "lib/mercadopago/finalize-album-order-mp-approved.duplicate.test.ts",
      "app/api/album-pack-orders/**/route.test.ts",
    ],
  },
});
