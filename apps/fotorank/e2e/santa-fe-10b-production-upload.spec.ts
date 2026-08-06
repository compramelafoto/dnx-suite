/**
 * E2E ETAPA 10B — upload productivo Santa Fe en Foco.
 * Requiere: publicUploadOpen=true + credenciales /tmp/sfef-09-e2e.env
 * Base URL: playwright.production.config.ts → fotorank.dnxsuite.com
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

/** JPEG válido ≥1200×800 generado en ops (`/tmp/sfef-10b-valid.jpg`). */
function loadValidJpeg(): Buffer {
  const path = process.env.SFEF10B_JPEG_PATH ?? "/tmp/sfef-10b-valid.jpg";
  if (!existsSync(path)) {
    throw new Error(`BLOCKED — missing valid JPEG fixture at ${path}`);
  }
  return readFileSync(path);
}

test.describe("Santa Fe ETAPA 10B Production upload @smoke", () => {
  const creds = loadCreds();

  test("login email + wizard upload + confirm + estado visible", async ({ page }) => {
    const email = creds.SFEF09_PARTICIPANT_EMAIL;
    const password = creds.SFEF09_PARTICIPANT_PASSWORD;
    if (!email || !password) throw new Error("BLOCKED — missing participant creds");

    await gotoWhenReady(page, `/login?next=/concursos/${CONTEST_SLUG}/inscripcion`);
    await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
    await page.waitForURL(new RegExp(`/concursos/${CONTEST_SLUG}/inscripcion`), {
      timeout: 60_000,
    });

    // Inscripción si falta
    const regNumber = page.getByTestId("registration-number");
    const insc = page.getByTestId("inscription-form");
    if (await insc.isVisible().catch(() => false)) {
      const category = page.getByTestId("inscription-category");
      if (await category.isVisible().catch(() => false)) {
        const options = await category.locator("option").allTextContents();
        const amateur = options.findIndex((t) => /Amateur/i.test(t));
        expect(amateur).toBeGreaterThanOrEqual(0);
        const value = await category.locator("option").nth(amateur).getAttribute("value");
        if (value) await category.selectOption(value);
      }
      const ig = page.getByTestId("inscription-instagram");
      if (await ig.isVisible().catch(() => false)) await ig.fill("@sfef_e2e_10b");
      await page.getByTestId("inscription-age").fill("28");
      await page.getByTestId("inscription-accept-rules").check();
      const license = page.getByTestId("inscription-accept-license");
      if (await license.isVisible().catch(() => false)) await license.check();
      await page.getByTestId("inscription-submit").click();
      await expect(regNumber).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(regNumber).toBeVisible({ timeout: 30_000 });
    }

    // Upload debe estar abierto
    await expect(page.getByTestId("upload-closed-notice")).toHaveCount(0);
    const panel = page.getByTestId("entry-upload-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });

    const start = page.getByTestId("upload-start");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    const fileInput = page.getByTestId("entry-file-input");
    await expect(fileInput).toBeVisible({ timeout: 20_000 });
    const jpeg = loadValidJpeg();
    await fileInput.setInputFiles({
      name: "sfef-10b-obra.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });

    // Esperar preview / metadata (validación client-side de dimensiones)
    await expect(page.getByTestId("entry-preview-wrap")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Seleccioná una fotografía válida/i)).toHaveCount(0);

    const photoNext = page.getByTestId("upload-photo-next");
    await expect(photoNext).toBeVisible({ timeout: 10_000 });
    await photoNext.click();

    // Datos condicionales
    const locality = page.getByTestId("entry-capture-locality");
    await expect(locality).toBeVisible({ timeout: 20_000 });
    await locality.fill("Rosario");
    await page.getByTestId("entry-territory-confirm").check();
    await page.getByTestId("entry-period-confirm").check();
    await page.getByTestId("entry-device-kind").selectOption("SMARTPHONE");
    const authorship = page.getByTestId("entry-authorship-declare");
    if (await authorship.isVisible().catch(() => false)) await authorship.check();
    const editing = page.getByTestId("entry-editing-declare");
    if (await editing.isVisible().catch(() => false)) await editing.check();
    const noAi = page.getByTestId("entry-no-ai-declare");
    if (await noAi.isVisible().catch(() => false)) await noAi.check();
    const igUpload = page.getByTestId("entry-instagram");
    if (await igUpload.isVisible().catch(() => false)) await igUpload.fill("@sfef_e2e_10b");

    const dataNext = page.getByTestId("upload-data-next");
    if (await dataNext.isVisible().catch(() => false)) await dataNext.click();

    const confirm = page.getByTestId("entry-confirm");
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await confirm.click();

    // Modal de confirmación final
    const modalConfirm = page.getByRole("button", { name: /Confirmar envío/i });
    await expect(modalConfirm).toBeVisible({ timeout: 15_000 });
    await modalConfirm.click();

    await expect(page.getByTestId("upload-step-confirmation")).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByTestId("upload-step-confirmation")).toContainText(/Envío recibido/i);

    // Sin fugas
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/storageKey|fotorank\/contests\//i);
    expect(body).not.toMatch(/gpsLatitude|gpsLongitude/i);
  });

  test("Google OAuth Production callback intacto", async ({ request }) => {
    const res = await request.get("/api/auth/google", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const loc = res.headers().location ?? "";
    expect(loc).toContain("accounts.google.com");
    expect(loc).toContain(
      encodeURIComponent("https://fotorank.dnxsuite.com/api/auth/google/callback"),
    );
    expect(loc).not.toContain("staging");
  });
});
