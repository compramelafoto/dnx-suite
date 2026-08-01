import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import type { E2EPhotographerCreds } from "../env";

const SESSION_COOKIE = "dnx_session";

export async function loginViaApi(
  request: APIRequestContext,
  creds: E2EPhotographerCreds
): Promise<void> {
  const res = await request.post("/api/auth/login", {
    data: { email: creds.email, password: creds.password },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; user?: { role?: string } };
  if (!res.ok()) {
    throw new Error(
      `Login API falló (${res.status()}) fotógrafo ${creds.label}: ${body.error ?? "sin detalle"}`
    );
  }
  expect(body.user?.role).toMatch(/PHOTOGRAPHER|LAB_PHOTOGRAPHER|ADMIN/);
}

/** Evita el prompt de ubicación (sessionStorage + click UI si aparece). */
export async function suppressWorkLocationPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("clf-work-location-prompt-dismissed", "1");
    } catch {
      /* ignore */
    }
  });
}

/** Modal global de fotógrafo sin work location — tapa el editor/dashboard si no se cierra. */
export async function dismissWorkLocationPrompt(page: Page): Promise<void> {
  await suppressWorkLocationPrompt(page);
  const dismiss = page.getByRole("button", { name: "Ahora no" });
  // El prompt monta async tras work-location-status; dar margen amplio.
  const appeared = await dismiss.isVisible({ timeout: 15_000 }).catch(() => false);
  if (!appeared) return;
  await dismiss.click({ force: true });
  await expect(dismiss).toHaveCount(0, { timeout: 15_000 });
}

export async function loginAsPhotographer(page: Page, creds: E2EPhotographerCreds): Promise<void> {
  await loginViaApi(page.request, creds);
  // Misma origin para poder setear sessionStorage antes del dashboard.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await suppressWorkLocationPrompt(page);
  await page.goto("/fotografo/diseno/plantillas/v2", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await dismissWorkLocationPrompt(page);
  const dash = page.getByTestId("template-v2-dashboard");
  await expect(dash).toBeVisible({ timeout: 45_000 });
}

export async function newAuthenticatedContext(
  browser: Browser,
  creds: E2EPhotographerCreds,
  baseURL: string
) {
  const context = await browser.newContext({ baseURL });
  await loginViaApi(context.request, creds);
  const page = await context.newPage();
  return { context, page };
}

export async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === SESSION_COOKIE && Boolean(c.value));
}
