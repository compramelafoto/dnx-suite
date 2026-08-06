import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://fotorank.dnxsuite.com";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/santa-fe-10c-production-matrix.spec.ts"],
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
