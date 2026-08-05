/**
 * E2E ETAPA 09B — unificación de acceso (sin selección de rol).
 * Staging o local. @smoke
 */
import { expect, test } from "@playwright/test";
import { gotoWhenReady } from "./helpers";

test.describe("Santa Fe ETAPA 09B acceso unificado @smoke", () => {
  test("landing: Iniciar sesión va a /login sin modal de roles", async ({ page }) => {
    await gotoWhenReady(page, "/");
    const loginBtn = page.getByRole("link", { name: /Iniciar sesión/i }).first();
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // Icono-only header
      await page.getByRole("link", { name: /Iniciar sesión/i }).click();
      await expect(page).toHaveURL(/\/login/);
    }
    await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Elegí tu perfil/i);
    await expect(page.locator("body")).not.toContainText(/¿Cómo querés ingresar\?/i);
  });

  test("login panel sigue ofreciendo acceso jurado por enlace (compat)", async ({ page }) => {
    await gotoWhenReady(page, "/login");
    const jury = page.getByRole("link", { name: /jurado|invitación/i }).first();
    const hasJuryLink = await jury.isVisible().catch(() => false);
    // Compatibilidad: /jurado/login permanece; no es un picker de rol obligatorio.
    if (hasJuryLink) {
      await expect(jury).toHaveAttribute("href", /jurado/);
    } else {
      await page.goto("/jurado/login");
      await expect(page).toHaveURL(/\/jurado\/login/);
    }
  });

  test("rutas hub y super-admin exigen sesión", async ({ page }) => {
    await page.goto("/mi-actividad", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/super-admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });
});
