import { test, expect } from "@playwright/test";
import { requireStorage } from "./helpers";

test.describe("Notificaciones CLF — preferencias y bandeja", () => {
  test("fotógrafo ve página de preferencias", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("photo_inapp"),
    });
    const page = await context.newPage();
    await page.goto("/fotografo/configuracion/notificaciones");
    await expect(
      page.getByRole("heading", { name: /Preferencias de notificaciones/i }),
    ).toBeVisible({ timeout: 45_000 });
    // No deben exponerse coordenadas
    await expect(page.getByText(/latitud|longitude|coordenadas/i)).toHaveCount(0);
    await context.close();
  });

  test("fotógrafo abre bandeja", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: requireStorage("photo_inapp"),
    });
    const page = await context.newPage();
    await page.goto("/fotografo/notificaciones");
    await expect(page).toHaveURL(/notificaciones/);
    await context.close();
  });

  test("token inválido de tracking falla seguro", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const res = await page.goto("/n/nt_token_invalido_qa_etapa21");
    // redirect o 4xx/404 seguro — no 500
    expect(res?.status() ?? 0).toBeLessThan(500);
    await context.close();
  });
});
