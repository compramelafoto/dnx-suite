import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Tests de los sorteos entre fotógrafos (`lib/raffles`). Mismo Vitest que `vitest.social.config.ts`. */
export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: { environment: "node", include: ["lib/raffles/**/*.test.ts"] },
});
