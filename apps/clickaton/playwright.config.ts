import { defineConfig, devices } from "@playwright/test";

/**
 * Clickatón QA readiness / QA2 harness.
 * Base URL defaults to staging; override with CLICKATON_E2E_BASE_URL.
 */
const baseURL =
  process.env.CLICKATON_E2E_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://clickaton-staging.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../.local/qa1/playwright-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      // Chromium mobile viewport (avoids WebKit browser download requirement).
      use: { ...devices["Pixel 7"] },
    },
  ],
});
