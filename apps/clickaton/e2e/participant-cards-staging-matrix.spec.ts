import { expect, test } from "@playwright/test";

/**
 * Matriz E2E staging P0-09 — participante A/B/C/D + admin + ownership.
 *
 * Requiere setup previo:
 *   CLICKATON_E2E_PARTICIPANT_CARDS_SETUP=1 DATABASE_URL=… \
 *     pnpm --filter clickaton e2e:clickaton-participant-cards:setup
 *
 * Y variables:
 *   CLICKATON_E2E_PARTICIPANT_CARDS=1
 *   CLICKATON_E2E_BASE_URL=https://clickaton-staging.vercel.app
 *   CLICKATON_E2E_USER_A_EMAIL / PASSWORD / REGISTRATION_ID
 *   CLICKATON_E2E_USER_B_* (sin Instagram)
 *   CLICKATON_E2E_USER_C_* (sin foto)
 *   CLICKATON_E2E_USER_D_* (ownership)
 *   CLICKATON_E2E_ADMIN_EMAIL / PASSWORD
 *
 * Sin skips opcionales: si el flag está en 1 y faltan credenciales, el test FALLA.
 */

const enabled = process.env.CLICKATON_E2E_PARTICIPANT_CARDS === "1";
const base =
  process.env.CLICKATON_E2E_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://clickaton-staging.vercel.app";

function req(name: string): string {
  const v = process.env[name]?.trim() ?? "";
  if (enabled && !v) {
    throw new Error(`Missing required E2E env ${name} (no silent skip)`);
  }
  return v;
}

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email|correo/i).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.waitForTimeout(2000);
}

async function cookieHeader(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe.configure({ mode: "serial" });

test.describe("P0-09 staging matrix", () => {
  test.beforeEach(() => {
    test.skip(!enabled, "CLICKATON_E2E_PARTICIPANT_CARDS !== 1");
  });

  test("Participante A — Welcome MISS→READY→HIT", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_USER_A_EMAIL");
    const password = req("CLICKATON_E2E_USER_A_PASSWORD");
    const registrationId = req("CLICKATON_E2E_USER_A_REGISTRATION_ID");
    await login(page, email, password);
    const cookie = await cookieHeader(page);
    const url = `${base}/api/account/registrations/${registrationId}/cards/welcome?disposition=inline`;

    const first = await request.get(url, { headers: { Cookie: cookie } });
    expect([200, 202]).toContain(first.status());
    if (first.status() === 202) {
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const poll = await request.get(url, { headers: { Cookie: cookie } });
        if (poll.status() === 200) {
          expect(poll.headers()["content-type"]).toContain("image/png");
          break;
        }
        expect([202, 200]).toContain(poll.status());
      }
    } else {
      expect(first.headers()["content-type"]).toContain("image/png");
      expect(["MISS", "REGENERATED", "HIT"]).toContain(
        first.headers()["x-clickaton-card-cache"]
      );
    }

    const second = await request.get(url, { headers: { Cookie: cookie } });
    expect(second.status()).toBe(200);
    expect(second.headers()["x-clickaton-card-cache"]).toBe("HIT");
    expect(second.headers()["etag"]).toBeTruthy();
  });

  test("Participante A — Member distinto de Welcome", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_USER_A_EMAIL");
    const password = req("CLICKATON_E2E_USER_A_PASSWORD");
    const registrationId = req("CLICKATON_E2E_USER_A_REGISTRATION_ID");
    await login(page, email, password);
    const cookie = await cookieHeader(page);
    const welcome = await request.get(
      `${base}/api/account/registrations/${registrationId}/cards/welcome?disposition=attachment`,
      { headers: { Cookie: cookie } }
    );
    const member = await request.get(
      `${base}/api/account/registrations/${registrationId}/cards/member?disposition=attachment`,
      { headers: { Cookie: cookie } }
    );
    expect(welcome.status()).toBe(200);
    expect(member.status()).toBe(200);
    const wBuf = Buffer.from(await welcome.body());
    const mBuf = Buffer.from(await member.body());
    expect(wBuf.equals(mBuf)).toBe(false);
    expect(member.headers()["content-disposition"]).toMatch(/member/i);
  });

  test("Participante B — sin Instagram genera READY", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_USER_B_EMAIL");
    const password = req("CLICKATON_E2E_USER_B_PASSWORD");
    const registrationId = req("CLICKATON_E2E_USER_B_REGISTRATION_ID");
    await login(page, email, password);
    const cookie = await cookieHeader(page);
    const res = await request.get(
      `${base}/api/account/registrations/${registrationId}/cards/welcome?disposition=inline`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 202]).toContain(res.status());
    if (res.status() === 200) {
      expect(res.headers()["content-type"]).toContain("image/png");
    }
  });

  test("Participante C — sin foto bloquea generación", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_USER_C_EMAIL");
    const password = req("CLICKATON_E2E_USER_C_PASSWORD");
    const registrationId = req("CLICKATON_E2E_USER_C_REGISTRATION_ID");
    await login(page, email, password);
    await page.goto(`${base}/mi-cuenta/inscripciones/${registrationId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/mis placas|foto/i).first()).toBeVisible();
    const cookie = await cookieHeader(page);
    const res = await request.get(
      `${base}/api/account/registrations/${registrationId}/cards/welcome`,
      { headers: { Cookie: cookie } }
    );
    expect([409, 422, 403]).toContain(res.status());
  });

  test("Ownership — D no accede a inscripción de A", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_USER_D_EMAIL");
    const password = req("CLICKATON_E2E_USER_D_PASSWORD");
    const foreignId = req("CLICKATON_E2E_USER_A_REGISTRATION_ID");
    await login(page, email, password);
    const cookie = await cookieHeader(page);
    const card = await request.get(
      `${base}/api/account/registrations/${foreignId}/cards/welcome`,
      { headers: { Cookie: cookie } }
    );
    const status = await request.get(
      `${base}/api/account/registrations/${foreignId}/cards/welcome/status`,
      { headers: { Cookie: cookie } }
    );
    expect(card.status()).toBe(404);
    expect(status.status()).toBe(404);
  });

  test("Admin — preview y regeneración Welcome", async ({ page, request }) => {
    const email = req("CLICKATON_E2E_ADMIN_EMAIL");
    const password = req("CLICKATON_E2E_ADMIN_PASSWORD");
    const registrationId = req("CLICKATON_E2E_USER_A_REGISTRATION_ID");
    await login(page, email, password);
    const cookie = await cookieHeader(page);
    const preview = await request.get(
      `${base}/api/admin/registrations/${registrationId}/cards/welcome?disposition=inline`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 202]).toContain(preview.status());
    const regen = await request.get(
      `${base}/api/admin/registrations/${registrationId}/cards/welcome?force=1&disposition=inline`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 202]).toContain(regen.status());
    if (regen.status() === 200) {
      expect(["REGENERATED", "MISS", "HIT"]).toContain(
        regen.headers()["x-clickaton-card-cache"]
      );
    }
  });
});
