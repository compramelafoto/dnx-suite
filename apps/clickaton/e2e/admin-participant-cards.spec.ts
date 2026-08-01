import { expect, test } from "@playwright/test";

/**
 * E2E smoke/contrato — placas participante panel admin.
 *
 * Deshabilitado por defecto. Habilitar con:
 *
 *   CLICKATON_E2E_PARTICIPANT_CARDS=1
 *   CLICKATON_E2E_BASE_URL=https://clickaton-staging.vercel.app
 *   CLICKATON_E2E_ADMIN_EMAIL=…
 *   CLICKATON_E2E_ADMIN_PASSWORD=…
 *   CLICKATON_E2E_REGISTRATION_ID=…   (cualquier inscripción existente en staging)
 *
 * Ejecutar:
 *   pnpm --filter clickaton test:e2e:clickaton-participant-cards
 */

const enabled = process.env.CLICKATON_E2E_PARTICIPANT_CARDS === "1";
const base =
  process.env.CLICKATON_E2E_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://clickaton-staging.vercel.app";
const adminEmail = process.env.CLICKATON_E2E_ADMIN_EMAIL?.trim() || "";
const adminPassword = process.env.CLICKATON_E2E_ADMIN_PASSWORD?.trim() || "";
const registrationId = process.env.CLICKATON_E2E_REGISTRATION_ID?.trim() || "";

const hasAdmin = Boolean(adminEmail && adminPassword);
const hasRegistration = Boolean(registrationId);

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email|correo/i).first().fill(adminEmail);
  await page.locator('input[type="password"]').first().fill(adminPassword);
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.waitForTimeout(2000);
}

test.describe.configure({ mode: "serial" });

test.describe("Admin participant cards — API contract", () => {
  test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");

  test("unauthenticated admin card API returns 401", async ({ request }) => {
    const res = await request.get(
      `${base}/api/admin/registrations/test-id/cards/welcome`
    );
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("CLICKATON_CARD_UNAUTHORIZED");
  });

  test("non-admin user gets 403 on admin card API", async ({ page, request }) => {
    const userEmail = process.env.CLICKATON_E2E_USER_EMAIL?.trim() || "";
    const userPassword = process.env.CLICKATON_E2E_USER_PASSWORD?.trim() || "";
    test.skip(!userEmail || !userPassword, "CLICKATON_E2E_USER_* no configurado");

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel(/email|correo/i).first().fill(userEmail);
    await page.locator('input[type="password"]').first().fill(userPassword);
    await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
    await page.waitForTimeout(2000);

    const cookies = await page.context().cookies();
    const res = await request.get(
      `${base}/api/admin/registrations/${registrationId || "test-id"}/cards/welcome`,
      { headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } }
    );
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("CLICKATON_CARD_FORBIDDEN");
  });
});

test.describe("Admin participant cards — panel UI", () => {
  test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");
  test.skip(!hasAdmin || !hasRegistration, "CLICKATON_E2E_ADMIN_* o REGISTRATION_ID ausente");

  test("registration detail shows participant cards panel", async ({ page }) => {
    await loginAdmin(page);
    const res = await page.goto(`${base}/admin/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("admin-participant-cards")).toBeVisible();
    await expect(page.getByRole("button", { name: /vista previa bienvenida/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ver diagnóstico/i })).toBeVisible();
  });

  test("diagnose returns JSON eligibility block", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${base}/admin/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: /ver diagnóstico/i }).click();
    await expect(page.locator("pre")).toContainText(/eligibility/i, { timeout: 90_000 });
  });
});
