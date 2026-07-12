import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/providers/vercel/**/*.ts"],
      exclude: ["src/providers/vercel/**/*.test.ts", "src/providers/vercel/types/**"],
    },
  },
});
