import { defineConfig, devices } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const baseURL =
  process.env.INFOSPOT_E2E_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3004";
const clfURL =
  process.env.CLF_E2E_BASE_URL ??
  process.env.PLAYWRIGHT_CLF_BASE_URL ??
  "http://127.0.0.1:3002";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "infospot-chromium",
      use: { ...devices["Desktop Chrome"], baseURL },
      testMatch: /notifications-infospot\.spec\.ts/,
    },
    {
      name: "clf-chromium",
      use: { ...devices["Desktop Chrome"], baseURL: clfURL },
      testMatch: /notifications-clf\.spec\.ts|notifications-attribution\.spec\.ts/,
    },
  ],
  // Permitir apuntar a Preview sin levantar webServer local.
  ...(process.env.INFOSPOT_E2E_BASE_URL || process.env.CLF_E2E_BASE_URL
    ? {}
    : {
        webServer: [
          {
            command: "pnpm dev",
            // Evitar `/` (home puede fallar si faltan columnas editoriales ajenas a notificaciones).
            url: `${baseURL}/ingresar`,
            reuseExistingServer: process.env.CI !== "true",
            timeout: 240_000,
            cwd: appDir,
            env: {
              ...process.env,
              NODE_ENV: process.env.NODE_ENV || "development",
            },
          },
          {
            command: "pnpm --filter compramelafoto dev",
            url: `${clfURL}/fotografo/login`,
            reuseExistingServer: process.env.CI !== "true",
            timeout: 240_000,
            cwd: appDir,
            env: {
              ...process.env,
              // Misma DB que InfoSpot (Neon staging) para flujo cross-app.
              DATABASE_URL: process.env.DATABASE_URL || "",
              DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
              NEXT_PUBLIC_APP_URL: clfURL,
              NEXT_PUBLIC_BASE_URL: clfURL,
              NODE_ENV: process.env.NODE_ENV || "development",
            },
          },
        ],
      }),
});
