import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: path.resolve(__dirname, ".env.local") });
loadEnv({ path: path.resolve(__dirname, ".env.e2e") });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  process.env.E2E_BASE_URL?.trim() ||
  "http://127.0.0.1:3002";

/**
 * E2E ComprameLaFoto (módulo escolar y otros).
 * Desde `apps/compramelafoto`: `pnpm test:e2e`
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === "true" ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120_000,
  },
});
