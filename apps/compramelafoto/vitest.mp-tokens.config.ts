import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Que los tokens de Mercado Pago no se puedan escribir desde el perfil ni viajen al navegador.
 * Usa el Vitest ya presente en el monorepo, igual que `vitest.payments.config.ts`.
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
      "lib/mercadopago/without-mp-tokens.test.ts",
      "app/api/fotografo/update/route.test.ts",
      "app/api/fotografo/[[]id]/route.test.ts",
      "app/api/lab/[[]id]/route.test.ts",
    ],
  },
});
