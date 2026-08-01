import { expect, test } from "@playwright/test";

/**
 * E2E smoke/contrato — placas participante (Template V2 on-demand).
 *
 * Deshabilitado por defecto. Habilitar con:
 *
 *   CLICKATON_E2E_PARTICIPANT_CARDS=1
 *   CLICKATON_E2E_BASE_URL=https://clickaton-staging.vercel.app
 *   CLICKATON_E2E_USER_EMAIL=…
 *   CLICKATON_E2E_USER_PASSWORD=…
 *   CLICKATON_E2E_REGISTRATION_ID=…   (inscripción confirmada del usuario)
 *
 * Ejecutar:
 *   pnpm --filter clickaton test:e2e:clickaton-participant-cards
 */

const enabled = process.env.CLICKATON_E2E_PARTICIPANT_CARDS === "1";
const base =
  process.env.CLICKATON_E2E_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://clickaton-staging.vercel.app";
const userEmail = process.env.CLICKATON_E2E_USER_EMAIL?.trim() || "";
const userPassword = process.env.CLICKATON_E2E_USER_PASSWORD?.trim() || "";
const registrationId = process.env.CLICKATON_E2E_REGISTRATION_ID?.trim() || "";

const hasUser = Boolean(userEmail && userPassword);
const hasRegistration = Boolean(registrationId);

async function loginParticipant(page: import("@playwright/test").Page) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email|correo/i).first().fill(userEmail);
  await page.locator('input[type="password"]').first().fill(userPassword);
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.waitForTimeout(2000);
}

test.describe.configure({ mode: "serial" });

test.describe("Participant cards — API contract", () => {
  test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");

  test("unauthenticated card API returns 401", async ({ request }) => {
    const res = await request.get(
      `${base}/api/account/registrations/test-id/cards/welcome`
    );
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("CLICKATON_CARD_UNAUTHORIZED");
  });

  test("invalid card type returns 422 when authenticated", async ({ page, request }) => {
    test.skip(!hasUser || !hasRegistration, "CLICKATON_E2E_USER_* o REGISTRATION_ID ausente");
    await loginParticipant(page);
    const cookies = await page.context().cookies();
    const res = await request.get(
      `${base}/api/account/registrations/${registrationId}/cards/not-a-type`,
      { headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } }
    );
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("CLICKATON_CARD_TEMPLATE_INVALID");
  });
});

test.describe("Participant cards — Mi cuenta UI", () => {
  test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");
  test.skip(!hasUser || !hasRegistration, "CLICKATON_E2E_USER_* o REGISTRATION_ID ausente");

  test("Mis placas section renders with preview testids", async ({ page }) => {
    await loginParticipant(page);
    await page.goto(`${base}/mi-cuenta/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/mis placas/i)).toBeVisible();
    await expect(page.getByTestId("clickaton-card-welcome-preview")).toBeVisible();
    await expect(page.getByTestId("clickaton-card-member-preview")).toBeVisible();
  });

  test("welcome preview opens dialog when available", async ({ page }) => {
    await loginParticipant(page);
    await page.goto(`${base}/mi-cuenta/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    const preview = page.getByTestId("clickaton-card-welcome-preview");
    if (!(await preview.isEnabled())) {
      test.skip(true, "Placa welcome no disponible para este fixture");
    }
    await preview.click();
    const dialog = page.getByTestId("clickaton-card-preview-dialog");
    await expect(dialog).toBeVisible({ timeout: 90_000 });
    await expect(
      page.getByTestId("clickaton-card-preview-image").or(
        page.getByTestId("clickaton-card-preview-error")
      )
    ).toBeVisible({ timeout: 90_000 });
  });
});
