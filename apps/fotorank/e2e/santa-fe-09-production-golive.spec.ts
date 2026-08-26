/**
 * E2E ETAPA 09 — go-live limitado Production (inscripción FREE, upload OFF).
 * Credenciales: /tmp/sfef-09-e2e.env (ops-sfef-09-production-e2e-fixtures.ts).
 *
 * @smoke
 */
import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { gotoWhenReady } from "./helpers";

function loadCreds(): Record<string, string> {
  const path = process.env.SFEF09_CREDS_PATH ?? "/tmp/sfef-09-e2e.env";
  if (!existsSync(path)) throw new Error(`BLOCKED — missing ${path}`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return out;
}

const CONTEST_SLUG = "santa-fe-en-foco";

test.describe("Santa Fe ETAPA 09 Production go-live @smoke", () => {
  const creds = loadCreds();

  test("landing pública responde", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}`);
    await expect(page.getByRole("heading", { name: /Santa Fe en Foco/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/BORRADOR — LEGAL REVIEW REQUIRED/i);
    await expect(page.locator("body")).not.toContainText(/NO PUBLICAR/i);
  });

  test("inscripción exige login y Google OAuth apunta a Production", async ({ page, request }) => {
    await page.goto(`/concursos/${CONTEST_SLUG}/inscripcion`, { waitUntil: "load" });
    await expect(page).toHaveURL(/\/login\?next=/);

    const res = await request.get("/api/auth/google", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const loc = res.headers().location ?? "";
    expect(loc).toContain("accounts.google.com");
    expect(loc).toContain(
      encodeURIComponent("https://fotorank.dnxsuite.com/api/auth/google/callback"),
    );
    expect(loc).not.toContain("staging");
  });

  test("login email + inscripción FREE + upload cerrado", async ({ page }) => {
    const email = creds.SFEF09_PARTICIPANT_EMAIL;
    const password = creds.SFEF09_PARTICIPANT_PASSWORD;
    if (!email || !password) throw new Error("BLOCKED — missing participant creds");

    await gotoWhenReady(page, `/login?next=/concursos/${CONTEST_SLUG}/inscripcion`);
    await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesión/i }).click();
    await page.waitForURL(new RegExp(`/concursos/${CONTEST_SLUG}/inscripcion`), {
      timeout: 60_000,
    });

    const regNumber = page.getByTestId("registration-number");
    const insc = page.getByTestId("inscription-form");
    await expect(regNumber.or(insc)).toBeVisible({ timeout: 30_000 });

    if (await insc.isVisible().catch(() => false)) {
      await expect(page.getByTestId("open-participation-note")).toBeVisible();

      const category = page.getByTestId("inscription-category");
      if (await category.isVisible().catch(() => false)) {
        const options = await category.locator("option").allTextContents();
        const amateur = options.findIndex((t) => /Amateur/i.test(t));
        expect(amateur).toBeGreaterThanOrEqual(0);
        const value = await category.locator("option").nth(amateur).getAttribute("value");
        if (value) await category.selectOption(value);
      }

      await page.getByTestId("inscription-age").fill("28");
      await page.getByTestId("inscription-accept-rules").check();
      const license = page.getByTestId("inscription-accept-license");
      if (await license.isVisible().catch(() => false)) await license.check();
      await page.getByTestId("inscription-submit").click();
      await expect(regNumber).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(regNumber).toBeVisible();
    }

    await expect(page.getByTestId("upload-closed-notice")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("entry-upload-panel")).toHaveCount(0);
  });

  test("dashboard participante accesible", async ({ page }) => {
    const email = creds.SFEF09_PARTICIPANT_EMAIL;
    const password = creds.SFEF09_PARTICIPANT_PASSWORD;
    await gotoWhenReady(page, "/login?next=/participaciones");
    await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesión/i }).click();
    await page.waitForURL(/\/participaciones/, { timeout: 60_000 });
    await expect(page.locator("body")).toContainText(/Santa Fe en Foco|particip/i);
  });

  test("admin panel accesible", async ({ page }) => {
    const email = creds.SFEF09_ADMIN_EMAIL;
    const password = creds.SFEF09_ADMIN_PASSWORD;
    if (!email || !password) {
      test.skip(true, "Admin creds no provisionadas");
      return;
    }
    await gotoWhenReady(page, "/login?next=/dashboard");
    await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesión/i }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 60_000 });
    if (page.url().includes("/onboarding")) {
      test.fail(true, "Admin sin organización en Production");
    }
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("resultados / ranking públicos no expuestos", async ({ page }) => {
    for (const path of [
      `/concursos/${CONTEST_SLUG}/resultados`,
      `/concursos/${CONTEST_SLUG}/ranking`,
      `/concursos/${CONTEST_SLUG}/jurado`,
    ]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      const body = await page.locator("body").innerText().catch(() => "");
      const leaked =
        /ganador|1er premio|ranking final|publicación oficial/i.test(body) &&
        !/no (hay|disponible)|próximamente|aún no/i.test(body);
      expect(status === 404 || status === 403 || !leaked).toBeTruthy();
    }
  });
});
