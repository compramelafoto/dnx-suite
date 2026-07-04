import { test, expect } from "@playwright/test";
import { getSchoolE2EConfig } from "./helpers/school-fixtures";
import * as schoolApi from "./helpers/school-api";

const cfg = getSchoolE2EConfig();
test.skip(!cfg, "Corré `pnpm e2e:prepare` en apps/compramelafoto o definí variables (e2e/env.example)");

test.describe("school-review UI @school-ui", () => {
  const c = cfg!;

  test("login fotógrafo y pantalla de revisión escolar (botones y fallback/preview)", async ({ page }) => {
    await page.goto("/fotografo/login");

    await page.getByPlaceholder("tu@email.com").fill(c.photographerEmail);
    await page.getByPlaceholder("••••••••").fill(c.photographerPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await page.waitForURL(/\/fotografo\//, { timeout: 30_000 });

    let designProjectId = c.designProjectIdOverride;
    if (designProjectId == null) {
      const ctx = page.request;
      await schoolApi.loginPhotographer(ctx, c);
      const sel = await schoolApi.postSelection(ctx, c, c.photoIds);
      expect(sel.ok()).toBeTruthy();
      const data = (await sel.json()) as { designProjectId?: number | null; designEnsure?: { ok: boolean } };
      if (!data.designEnsure?.ok || !data.designProjectId) {
        test.skip(true, "No se pudo obtener designProjectId desde selección; definí E2E_SCHOOL_DESIGN_PROJECT_ID");
        return;
      }
      designProjectId = data.designProjectId;
    }

    await page.goto(`/fotografo/diseno/escolar/${c.albumId}/${designProjectId}`);

    await expect(page.getByRole("heading", { name: "Revisión de diseño escolar" })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("button", { name: "Regenerar preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprobar para export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedir ajustes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar JPG" })).toBeVisible();

    await expect(page.getByText(/Fotos disponibles/i)).toBeVisible();

    const previewOrFallback = page.locator('img[alt="Preview renderizada"], img[alt="Plantilla"]');
    await expect(previewOrFallback.first()).toBeVisible({ timeout: 15_000 });
  });
});
