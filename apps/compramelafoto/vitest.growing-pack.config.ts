import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
// «Todas mis fotos» que se van sumando (eventos de varios días).
export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: [
      "lib/album-packs/growing-pack/**/*.test.ts",
      "lib/digital-download/order-digital-photo-ids.test.ts",
    ],
  },
});
