import { defineConfig, devices } from "@playwright/test";

/** Preferir localhost (no 127.0.0.1) para evitar bloqueo Next allowedDevOrigins/HMR. */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002";

/**
 * E2E focalizado Template V2 (P0-04).
 * No ejecuta la suite global del monorepo.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/template-v2*.spec.ts"],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/template-v2" }],
  ],
  outputDir: "test-results/template-v2",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-AR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: process.env.CI !== "true",
    timeout: 180_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)
    ),
  },
});
