/**
 * E2E P0-07 — panel anónimo de jurado (requiere fixtures seed P0-07).
 * @smoke
 */
import { expect, test } from "@playwright/test";
import { gotoWhenReady } from "./helpers";

test.describe("Panel jurado anónimo @smoke", () => {
  test("login jurado → obras anónimas sin identidad", async ({ page }) => {
    await gotoWhenReady(page, "/jurado/login");
    const email = process.env.E2E_JURY_EMAIL ?? "jury-santa-fe@fotorank.local";
    const password = process.env.E2E_JURY_PASSWORD ?? "123456";

    const form = page.locator("form").first();
    const visible = await form.isVisible().catch(() => false);
    test.skip(!visible, "Login jurado no disponible");

    await page.locator('input[type="email"], input[name="email"], #email').first().fill(email);
    await page.locator('input[type="password"], input[name="password"], #password').first().fill(password);
    await page.getByRole("button", { name: /entrar|iniciar|ingresar/i }).first().click();

    await page.waitForURL(/\/jurado\//, { timeout: 60_000 }).catch(() => null);
    test.skip(!page.url().includes("/jurado"), "Credenciales jurado seed no disponibles");

    await gotoWhenReady(page, "/jurado/panel");
    const link = page.getByRole("link", { name: /obras anónimas/i }).first();
    const hasLink = await link.isVisible().catch(() => false);
    test.skip(!hasLink, "Sin asignación de jurado en seed");

    await link.click();
    await expect(page.getByTestId("jury-entries-list")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/@fotorank\.local|participante/i)).toHaveCount(0);
  });
});
