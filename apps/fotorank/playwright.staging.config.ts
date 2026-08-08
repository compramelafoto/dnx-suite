import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://fotorank.staging.dnxsuite.com";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/santa-fe-05b-staging-matrix.spec.ts",
    "**/santa-fe-06-admission-staging-matrix.spec.ts",
    "**/santa-fe-07-jury-staging-matrix.spec.ts",
    "**/santa-fe-08-results-staging-matrix.spec.ts",
    "**/santa-fe-11-access-matrix.spec.ts",
    "**/santa-fe-eligibility-staging.spec.ts",
  ],
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer: apunta a staging real.
});
