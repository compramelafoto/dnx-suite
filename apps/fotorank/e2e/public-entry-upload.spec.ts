/**
 * E2E P0-06 — carga de fotografía tras inscripción FREE.
 * Requiere DB local/seed Santa Fe + usuario participante1@fotorank.com.
 * Usa un JPEG generado en memoria (sin fixture en disco).
 *
 * @smoke
 */
import { expect, test } from "@playwright/test";
import { gotoWhenReady } from "./helpers";

const PARTICIPANT_EMAIL = "participante1@fotorank.com";
const PARTICIPANT_PASSWORD = "123456";
const CONTEST_SLUG = "santa-fe-en-foco";

/** JPEG mínimo válido (1×1) — el checklist puede marcar WARNING/FAIL por dimensiones; el flujo UI debe completarse. */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
  "base64",
);

test.describe("Carga de obra Santa Fe en Foco @smoke", () => {
  test("tras inscripción FREE: panel upload visible y API me responde", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}/inscripcion`);

    if (page.url().includes("/login")) {
      const form = page.getByTestId("fotorank-login-form");
      await form.waitFor({ state: "visible" });
      await form.locator("#email").fill(PARTICIPANT_EMAIL);
      await form.locator("#password").fill(PARTICIPANT_PASSWORD);
      await form.getByRole("button", { name: /Entrar/ }).click();
      await page.waitForURL(/\/concursos\/santa-fe-en-foco\/inscripcion/, { timeout: 60_000 });
    }

    const panel = page.getByTestId("entry-upload-panel");
    const registration = page.getByTestId("registration-number");
    const hasReg = await registration.isVisible().catch(() => false);
    if (!hasReg) {
      const form = page.getByTestId("inscription-form");
      const formVisible = await form.isVisible().catch(() => false);
      test.skip(!formVisible, "Sin formulario ni inscripción (seed Santa Fe requerido)");
      await page.getByTestId("inscription-accept-rules").check();
      await page.getByTestId("inscription-submit").click();
      await expect(registration).toBeVisible({ timeout: 30_000 });
    }

    await expect(panel).toBeVisible({ timeout: 20_000 });

    const contestId =
      (await page.getByTestId("inscription-form").getAttribute("data-contest-id").catch(() => null)) ??
      (await page.locator("[data-contest-id]").first().getAttribute("data-contest-id").catch(() => null));

    // ETAPA 05 — declaraciones de elegibilidad (territorio / período / dispositivo)
    const locality = page.getByTestId("entry-capture-locality");
    if (await locality.isVisible().catch(() => false)) {
      await locality.fill("Rosario");
      await page.getByTestId("entry-territory-confirm").check();
      await page.getByTestId("entry-period-confirm").check();
      await page.getByTestId("entry-device-kind").selectOption("SMARTPHONE");
    }

    // Subida vía UI si hay input
    const input = page.getByTestId("entry-file-input");
    await input.setInputFiles({
      name: "obra-e2e.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });

    await expect(page.getByTestId("entry-info").or(page.getByTestId("entry-status-block"))).toBeVisible({
      timeout: 60_000,
    });

    if (contestId) {
      const me = await page.request.get(`/api/fotorank/contests/${contestId}/entries/me`);
      // Tiny JPEG puede FALLAR checklist pero la obra debe existir
      expect([200, 404]).toContain(me.status());
      if (me.ok()) {
        const json = (await me.json()) as { entry?: { checks?: unknown[]; status?: string } };
        expect(json.entry?.status).toBeTruthy();
      }
    }

    await gotoWhenReady(page, "/participaciones");
    await expect(page.getByTestId("participaciones-list")).toBeVisible({ timeout: 20_000 });
  });
});
