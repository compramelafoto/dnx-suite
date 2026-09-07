import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Ver test/server-only-stub.ts: Next resuelve este especificador, vitest no.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
