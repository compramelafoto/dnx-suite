import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@repo/design-system/components/partners": path.resolve(
        __dirname,
        "../../../../packages/design-system/src/design-system/components/partners/index.ts",
      ),
    },
  },
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
});
