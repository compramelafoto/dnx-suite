import { expect, test } from "@playwright/test";

/**
 * Smoke UX público en staging — no funnel de pago ni mutaciones.
 */
test.describe("Clickatón public UX smoke", () => {
  test("home + mobile menu navegan sin overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
    );
    expect(overflow).toBe(false);

    const menu = page.getByRole("button", { name: /Abrir menú/i });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("link", { name: /Cómo funciona/i }).first()).toBeVisible();
    testInfo.annotations.push({ type: "viewport", description: "390x844" });
  });

  test("rutas de marketing responden 200", async ({ page }) => {
    for (const path of [
      "/como-funciona",
      "/comunidad",
      "/sobre",
      "/contacto",
      "/legal/terminos",
      "/legal/privacidad",
      "/login",
    ]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), path).toBe(200);
    }
  });

  test("404 usable en español", async ({ page }) => {
    const res = await page.goto("/ruta-inexistente-ux-etapa03", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /no encontramos|no encontrada|no existe/i,
    );
  });

  test("mi-cuenta exige sesión (redirect login)", async ({ page }) => {
    const res = await page.goto("/mi-cuenta", { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    expect([200, 302, 307, 308]).toContain(status);
    await expect(page).toHaveURL(/login/);
  });
});
