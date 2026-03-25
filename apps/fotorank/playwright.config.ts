import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  /** Login + 2 formularios admin (crear/editar) + expect encadenados superan ~150s en `next dev`. */
  timeout: 240_000,
  fullyParallel: true,
  /** 1 worker en local (evita carreras en `next dev`). En CI (`CI=true`): 2 workers. Esperas por condición, sin sleeps fijos. */
  workers: process.env.CI === "true" ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === "true" ? 1 : 0,
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
    /** Reutilizar servidor local salvo CI explícito (`CI=true`). */
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
    ),
  },
});
