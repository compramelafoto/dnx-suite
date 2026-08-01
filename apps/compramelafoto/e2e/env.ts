/**
 * Variables E2E Template V2 — nunca hardcodear secretos en el repo.
 *
 * Local:
 *   CLF_E2E_PHOTOGRAPHER_A_EMAIL / CLF_E2E_PHOTOGRAPHER_A_PASSWORD
 *   CLF_E2E_PHOTOGRAPHER_B_EMAIL / CLF_E2E_PHOTOGRAPHER_B_PASSWORD
 *   PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3002)
 *
 * Staging:
 *   mismas vars + PLAYWRIGHT_BASE_URL=https://…
 *
 * Preparación local de usuarios:
 *   CLF_E2E_PHOTOGRAPHER_PASSWORD='…' pnpm --filter compramelafoto e2e:ensure-template-v2-photographers
 */

export type E2EPhotographerCreds = { email: string; password: string; label: "A" | "B" };

function readCreds(label: "A" | "B"): E2EPhotographerCreds | null {
  const email = (process.env[`CLF_E2E_PHOTOGRAPHER_${label}_EMAIL`] ?? "").trim();
  const password = (process.env[`CLF_E2E_PHOTOGRAPHER_${label}_PASSWORD`] ?? "").trim();
  if (!email || !password) return null;
  return { email, password, label };
}

export function getPhotographerA(): E2EPhotographerCreds {
  const c = readCreds("A");
  if (!c) {
    throw new Error(
      "Faltan CLF_E2E_PHOTOGRAPHER_A_EMAIL / CLF_E2E_PHOTOGRAPHER_A_PASSWORD. Corré e2e:ensure-template-v2-photographers."
    );
  }
  return c;
}

export function getPhotographerB(): E2EPhotographerCreds {
  const c = readCreds("B");
  if (!c) {
    throw new Error(
      "Faltan CLF_E2E_PHOTOGRAPHER_B_EMAIL / CLF_E2E_PHOTOGRAPHER_B_PASSWORD. Corré e2e:ensure-template-v2-photographers."
    );
  }
  return c;
}

export function hasE2ECredentials(): boolean {
  return Boolean(readCreds("A") && readCreds("B"));
}

export function e2eRunId(): string {
  return (process.env.CLF_E2E_RUN_ID ?? `run-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

export function e2eTemplateName(runId: string, suffix = ""): string {
  return `E2E TEMPLATE V2 — ${runId}${suffix ? ` ${suffix}` : ""}`;
}

/** Errores de consola conocidos / no bloqueantes en next dev. */
export const ALLOWED_CONSOLE_ERROR_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Fast Refresh/i,
  /\[HMR\]/i,
  /favicon\.ico/i,
  /LOGO CLF\.png/i,
  /isn't a valid image/i,
  /Failed to load resource: the server responded with a status of 404/i,
  // Assets de chrome / prompt no relacionados al editor (p.ej. logo roto → 400)
  /Failed to load resource: the server responded with a status of 400/i,
];
