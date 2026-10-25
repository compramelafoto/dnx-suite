import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // Next resuelve este especificador, vitest no: se reemplaza por un archivo vacío.
      "server-only": path.resolve(root, "test/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
