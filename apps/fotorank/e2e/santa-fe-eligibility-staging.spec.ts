/**
 * E2E ETAPA 05 — elegibilidad Santa Fe (participación abierta, Amateur, ARGRA, territorio).
 * Staging/local seguro: JPEG sintético, sin fotos reales.
 *
 * @smoke
 */
import { expect, test } from "@playwright/test";
import { gotoWhenReady } from "./helpers";

const PARTICIPANT_EMAIL = process.env.E2E_PARTICIPANT_EMAIL ?? "participante1@fotorank.com";
const PARTICIPANT_PASSWORD = process.env.E2E_PARTICIPANT_PASSWORD ?? "123456";
const CONTEST_SLUG = "santa-fe-en-foco";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
  "base64",
);

async function loginIfNeeded(page: import("@playwright/test").Page) {
  if (!page.url().includes("/login")) return;
  const form = page.getByTestId("fotorank-login-form");
  await form.waitFor({ state: "visible" });
  await form.locator("#email").fill(PARTICIPANT_EMAIL);
  await form.locator("#password").fill(PARTICIPANT_PASSWORD);
  await form.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL(/\/concursos\/santa-fe-en-foco\/inscripcion/, { timeout: 60_000 });
}

test.describe("Santa Fe ETAPA 05 elegibilidad @smoke", () => {
  test("participación abierta + Amateur + territorio + carga sintética", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}/inscripcion`);
    await loginIfNeeded(page);

    const openNote = page.getByTestId("open-participation-note");
    const hasOpen = await openNote.isVisible().catch(() => false);
    const hasReg = await page.getByTestId("registration-number").isVisible().catch(() => false);

    if (!hasReg) {
      const form = page.getByTestId("inscription-form");
      test.skip(!(await form.isVisible().catch(() => false)), "Sin formulario (seed Santa Fe requerido)");
      await expect(openNote).toBeVisible();
      const category = page.getByTestId("inscription-category");
      if (await category.isVisible().catch(() => false)) {
        const options = await category.locator("option").allTextContents();
        const amateur = options.findIndex((t) => /Amateur/i.test(t));
        if (amateur >= 0) {
          const value = await category.locator("option").nth(amateur).getAttribute("value");
          if (value) await category.selectOption(value);
        }
      }
      await page.getByTestId("inscription-age").fill("28");
      await page.getByTestId("inscription-accept-rules").check();
      const license = page.getByTestId("inscription-accept-license");
      if (await license.isVisible().catch(() => false)) await license.check();
      await page.getByTestId("inscription-submit").click();
      await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 30_000 });
    } else if (hasOpen) {
      await expect(openNote).toBeVisible();
    }

    const panel = page.getByTestId("entry-upload-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("entry-capture-locality").fill("Rosario");
    await page.getByTestId("entry-territory-confirm").check();
    await page.getByTestId("entry-period-confirm").check();
    await page.getByTestId("entry-device-kind").selectOption("SMARTPHONE");
    await page.getByTestId("entry-file-input").setInputFiles({
      name: "sf-amateur-e2e.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });
    await expect(page.getByTestId("entry-info").or(page.getByTestId("entry-status-block"))).toBeVisible({
      timeout: 60_000,
    });
  });

  test("Reportero Gráfico sin ARGRA → error; con ARGRA continúa", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}/inscripcion`);
    await loginIfNeeded(page);

    const hasReg = await page.getByTestId("registration-number").isVisible().catch(() => false);
    test.skip(hasReg, "Usuario ya inscripto — no se puede re-probar ARGRA en la misma cuenta");

    const form = page.getByTestId("inscription-form");
    test.skip(!(await form.isVisible().catch(() => false)), "Sin formulario");

    const category = page.getByTestId("inscription-category");
    test.skip(!(await category.isVisible().catch(() => false)), "Una sola categoría o select ausente");

    const options = await category.locator("option").allTextContents();
    const reporterIdx = options.findIndex((t) => /Reportero/i.test(t));
    test.skip(reporterIdx < 0, "Categoría Reportero no seedada");
    const value = await category.locator("option").nth(reporterIdx).getAttribute("value");
    if (value) await category.selectOption(value);

    await expect(page.getByTestId("inscription-argra")).toBeVisible();
    await page.getByTestId("inscription-age").fill("30");
    await page.getByTestId("inscription-accept-rules").check();
    const license = page.getByTestId("inscription-accept-license");
    if (await license.isVisible().catch(() => false)) await license.check();
    await page.getByTestId("inscription-submit").click();
    await expect(page.getByRole("alert").or(page.locator("[role='alert']"))).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("inscription-argra").fill("TEST-ARGRA-001");
    await page.getByTestId("inscription-submit").click();
    await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 30_000 });
  });
});
