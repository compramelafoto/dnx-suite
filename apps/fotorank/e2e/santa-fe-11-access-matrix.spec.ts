/**
 * E2E ETAPA 11 — detección automática de permisos (sin selector de rol).
 * Staging/Preview. Requiere /tmp/sfef-11-creds.env
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

function loadCreds() {
  const path = process.env.SFEF11_CREDS_PATH ?? "/tmp/sfef-11-creds.env";
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

async function loginAndCaptureDestination(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "load" });
  const form = page.getByTestId("fotorank-login-form");
  await form.waitFor({ state: "visible" });
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL(
      /\/(mi-actividad|participaciones|dashboard|jurado\/login|concursos|super-admin)(\/|$|\?)/,
      { timeout: 60_000, waitUntil: "commit" },
    ),
    form.getByRole("button", { name: /Entrar/i }).click(),
  ]);
  await expect(page.locator("body")).not.toContainText(/¿Cómo querés ingresar\?/i);
  await expect(page.locator("body")).not.toContainText(/Elegí tu perfil/i);
  return page.url();
}

async function logoutBestEffort(page: Page) {
  await page.context().clearCookies();
}

test.describe("Santa Fe ETAPA 11 access matrix @smoke", () => {
  const creds = loadCreds();
  const password = creds.SFEF11_PASSWORD;
  test.beforeEach(async ({ page }) => {
    await logoutBestEffort(page);
  });

  test("01 participante solamente → /participaciones", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_PARTICIPANT_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/participaciones/);
  });

  test("02 organizador solamente → /dashboard", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_ORGANIZER_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/dashboard/);
  });

  test("03 jurado solamente → /jurado/login", async ({ page }) => {
    const url = await loginAndCaptureDestination(page, creds.SFEF11_JURY_EMAIL!, password!);
    expect(url).toMatch(/\/jurado\/login/);
  });

  test("04 participante + jurado → /mi-actividad", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_PART_JURY_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/mi-actividad/);
    await expect(page.getByTestId("section-participaciones")).toBeVisible();
    await expect(page.getByTestId("section-jurado")).toBeVisible();
  });

  test("05 organizador + participante → /mi-actividad", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_ORG_PART_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/mi-actividad/);
    await expect(page.getByTestId("section-organizaciones")).toBeVisible();
    await expect(page.getByTestId("section-participaciones")).toBeVisible();
  });

  test("06 organizador + jurado → /mi-actividad", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_ORG_JURY_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/mi-actividad/);
    await expect(page.getByTestId("section-organizaciones")).toBeVisible();
    await expect(page.getByTestId("section-jurado")).toBeVisible();
  });

  test("07 Super Admin → /mi-actividad + panel", async ({ page }) => {
    const url = await loginAndCaptureDestination(
      page,
      creds.SFEF11_SUPER_ADMIN_EMAIL!,
      password!,
    );
    expect(url).toMatch(/\/mi-actividad/);
    await expect(page.getByTestId("section-super-admin")).toBeVisible();
    await page.goto("/super-admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("super-admin-panel")).toBeVisible();
    await expect(page.getByTestId("super-admin-act-as")).toBeVisible();
    // Santa Fe accesible en listado
    await expect(page.locator("body")).toContainText(/Santa Fe en Foco/i);
  });

  test("08 usuario sin actividad → hub vacío", async ({ page }) => {
    const url = await loginAndCaptureDestination(page, creds.SFEF11_EMPTY_EMAIL!, password!);
    expect(url).toMatch(/\/mi-actividad/);
    await expect(page.getByTestId("mi-actividad-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /Explorar concursos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver concursos abiertos/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/¿Cómo querés ingresar\?/i);
  });
});
