/**
 * E2E mínimo P0-01 — inscripción FREE.
 * Requiere: migrate P0-01 + `pnpm --filter @repo/db exec tsx prisma/scripts/seed-santa-fe-en-foco.ts`
 * y usuario participante1@fotorank.com (seed principal).
 *
 * @smoke
 */
import { expect, test } from "@playwright/test";
import { gotoWhenReady } from "./helpers";

const PARTICIPANT_EMAIL = "participante1@fotorank.com";
const PARTICIPANT_PASSWORD = "123456";
const CONTEST_SLUG = "santa-fe-en-foco";

test.describe("Inscripción FREE Santa Fe en Foco @smoke", () => {
  test("Participar → login → aceptar bases → número → /participaciones", async ({ page }) => {
    await gotoWhenReady(page, `/concursos/${CONTEST_SLUG}`);

    const participate = page.locator("#inscribirse");
    const visible = await participate.isVisible().catch(() => false);
    test.skip(!visible, "Concurso santa-fe-en-foco no publicado (correr seed-santa-fe-en-foco)");

    await participate.click();
    await page.waitForURL(/\/(login|concursos\/santa-fe-en-foco\/inscripcion)/);

    if (page.url().includes("/login")) {
      const form = page.getByTestId("fotorank-login-form");
      await form.waitFor({ state: "visible" });
      await form.locator("#email").fill(PARTICIPANT_EMAIL);
      await form.locator("#password").fill(PARTICIPANT_PASSWORD);
      await form.getByRole("button", { name: /Entrar/ }).click();
      await page.waitForURL(/\/concursos\/santa-fe-en-foco\/inscripcion/, { timeout: 60_000 });
    }

    let contestId =
      (await page.getByTestId("inscription-form").getAttribute("data-contest-id").catch(() => null)) ?? "";

    const already = page.getByTestId("registration-number");
    if (await already.isVisible().catch(() => false)) {
      await expect(already).toBeVisible();
    } else {
      const form = page.getByTestId("inscription-form");
      await expect(form).toBeVisible({ timeout: 20_000 });
      contestId = (await form.getAttribute("data-contest-id")) ?? "";
      await page.getByTestId("inscription-accept-rules").check();
      await page.getByTestId("inscription-submit").click();
      await expect(page.getByTestId("registration-number")).toBeVisible({ timeout: 30_000 });
    }

    const numberText = (await page.getByTestId("registration-number").innerText()).trim();
    expect(numberText.length).toBeGreaterThan(3);

    if (contestId) {
      const me = await page.request.get(`/api/fotorank/contests/${contestId}/registrations/me`);
      expect(me.ok()).toBeTruthy();
      const json = (await me.json()) as {
        registration?: { paymentOrderId?: string | null; paymentStatus?: string };
      };
      expect(json.registration?.paymentOrderId ?? null).toBeNull();
      expect(json.registration?.paymentStatus).toBe("NOT_REQUIRED");
    }

    await gotoWhenReady(page, "/participaciones");
    await expect(page.getByTestId("participaciones-list")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(numberText)).toBeVisible();
  });
});
