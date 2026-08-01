import { expect, test } from "@playwright/test";

/**
 * E2E persistencia — placas participante (caché HIT en segunda solicitud).
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
 *   pnpm --filter clickaton test:e2e:clickaton-participant-cards:persistence
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

test.describe("Participant cards — persistence cache", () => {
  test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");
  test.skip(!hasUser || !hasRegistration, "CLICKATON_E2E_USER_* o REGISTRATION_ID ausente");

  test("second card request returns X-Clickaton-Card-Cache HIT", async ({
    page,
    request,
  }) => {
    await loginParticipant(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const cardUrl = `${base}/api/account/registrations/${registrationId}/cards/welcome?disposition=inline`;

    const first = await request.get(cardUrl, {
      headers: { Cookie: cookieHeader },
    });
    expect(first.status(), "first request should succeed").toBe(200);
    const firstCache = first.headers()["x-clickaton-card-cache"];
    expect(firstCache, "first request cache header").toBeTruthy();
    expect(["MISS", "REGENERATED", "HIT"]).toContain(firstCache);

    const second = await request.get(cardUrl, {
      headers: { Cookie: cookieHeader },
    });
    expect(second.status(), "second request should succeed").toBe(200);
    expect(second.headers()["x-clickaton-card-cache"]).toBe("HIT");

    const etag = second.headers()["etag"];
    if (etag) {
      const conditional = await request.get(cardUrl, {
        headers: {
          Cookie: cookieHeader,
          "If-None-Match": etag,
        },
      });
      expect(conditional.status()).toBe(304);
      expect(conditional.headers()["x-clickaton-card-cache"]).toBe("HIT");
    }
  });
});
