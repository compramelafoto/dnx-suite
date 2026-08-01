import { expect, test } from "@playwright/test";
import { CANONICAL_ADMIN_ROUTES } from "./helpers/canonical-admin-routes";

/**
 * Auth staging smoke — requiere credenciales por entorno (nunca en repo).
 *
 *   CLICKATON_E2E_ADMIN_EMAIL=…
 *   CLICKATON_E2E_ADMIN_PASSWORD=…
 *   CLICKATON_E2E_USER_EMAIL=…        (opcional, noperm / participant)
 *   CLICKATON_E2E_USER_PASSWORD=…
 *   CLICKATON_E2E_BASE_URL=https://clickaton-staging.vercel.app
 *
 * Sin variables → tests skipped (CI seguro).
 */
const base =
  process.env.CLICKATON_E2E_BASE_URL?.trim() ||
  "https://clickaton-staging.vercel.app";

const adminEmail = process.env.CLICKATON_E2E_ADMIN_EMAIL?.trim() || "";
const adminPassword = process.env.CLICKATON_E2E_ADMIN_PASSWORD?.trim() || "";
const userEmail = process.env.CLICKATON_E2E_USER_EMAIL?.trim() || "";
const userPassword = process.env.CLICKATON_E2E_USER_PASSWORD?.trim() || "";
const registrationId = process.env.CLICKATON_E2E_REGISTRATION_ID?.trim() || "";

const hasAdmin = Boolean(adminEmail && adminPassword);
const hasUser = Boolean(userEmail && userPassword);

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email|correo/i).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.waitForTimeout(2000);
}

test.describe("Clickatón staging authenticated UX", () => {
  test.skip(!hasAdmin, "CLICKATON_E2E_ADMIN_* no configurado");

  test("admin login reaches panel", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /inicio del panel/i,
    );
  });

  test("admin registrations list opens", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    const res = await page.goto(`${base}/admin/inscripciones`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /inscripciones/i,
    );
  });

  test("finance routes do not render a not-found soft 404", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    for (const route of [
      CANONICAL_ADMIN_ROUTES.financePartner,
      CANONICAL_ADMIN_ROUTES.financeOwner,
    ]) {
      const res = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      expect(await page.locator("body").innerText()).not.toMatch(/No encontramos/i);
    }
  });

  test("admin logout control present or session clearable", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
    const logout = page
      .getByRole("button", { name: /cerrar sesión|salir/i })
      .or(page.getByRole("link", { name: /cerrar sesión|salir/i }));
    expect(await logout.count()).toBeGreaterThan(0);
  });
});

test("staging home canonical never points to production", async ({ page }) => {
  test.skip(!/clickaton-staging\.vercel\.app/i.test(base), "solo aplica al host staging");
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical ?? "").not.toMatch(/maratonfotografica\.com/i);
});

test.describe("Clickatón staging forbidden / participant", () => {
  test.skip(!hasUser, "CLICKATON_E2E_USER_* no configurado");

  test("user without admin role is denied", async ({ page }) => {
    await login(page, userEmail, userPassword);
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /no tenés permiso|acceso denegado|sin permiso/i,
    );
  });

  test("registration detail always has a non-empty H1", async ({ page }) => {
    test.skip(!registrationId, "CLICKATON_E2E_REGISTRATION_ID no configurado");
    await login(page, userEmail, userPassword);
    await page.goto(`${base}/mi-cuenta/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(/\S/);
  });
});
