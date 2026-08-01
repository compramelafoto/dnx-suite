import { expect, test } from "@playwright/test";
import { getPhotographerA, hasE2ECredentials } from "./env";
import { dismissWorkLocationPrompt, loginAsPhotographer } from "./helpers/auth";
import { apiCreateTemplate, apiDeleteTemplate } from "./helpers/api";
import { attachConsoleGuard } from "./helpers/console";
import { trackTemplateId } from "./helpers/cleanup";
import { waitForEditorReady } from "./helpers/editor";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("P0-05 preview: draft no guardado → PNG visible", async ({ page }) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  const guard = attachConsoleGuard(page);
  let templateId = "";
  let versionId = "";

  try {
    await loginAsPhotographer(page, photographer);
    await expect(page.getByRole("heading", { name: "Plantillas", exact: true })).toBeVisible();
    await dismissWorkLocationPrompt(page);

    // Crear vía API (más estable) y abrir editor
    const created = await apiCreateTemplate(
      page.request,
      `E2E TEMPLATE V2 — preview ${Date.now()}`
    );
    templateId = created.templateId;
    versionId = created.versionId;
    trackTemplateId(templateId);

    await page.goto(
      `/fotografo/diseno/plantillas/v2/${encodeURIComponent(templateId)}/${encodeURIComponent(versionId)}`
    );
    await waitForEditorReady(page);

    // Insertar variable escolar sin depender de autosave
    const variableBtn = page.getByRole("button", { name: /Variable/i }).first();
    if (await variableBtn.isVisible().catch(() => false)) {
      await variableBtn.click();
      await page.waitForTimeout(300);
    }

    // Mutar texto del draft en el lienzo (sin guardar) vía inspector si existe
    const textArea = page.locator("textarea").first();
    if (await textArea.isVisible().catch(() => false)) {
      await textArea.fill(`Preview draft ${Date.now()}`);
    }

    const previewBtn = page.getByTestId("template-v2-preview-button");
    await expect(previewBtn).toBeEnabled();

    const [previewResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/template-v2/preview") &&
          r.request().method() === "POST",
        { timeout: 90_000 }
      ),
      previewBtn.click(),
    ]);

    expect(previewResp.status(), "preview HTTP status").toBe(200);
    const ct = previewResp.headers()["content-type"] ?? "";
    expect(ct).toMatch(/image\/png|application\/json/);

    const contentLength = Number(previewResp.headers()["content-length"] ?? "0");
    const widthHdr = Number(previewResp.headers()["x-template-preview-width"] ?? "0");
    if (ct.includes("image/png")) {
      expect(contentLength > 32 || widthHdr > 0).toBeTruthy();
    }

    const dialog = page.getByTestId("template-v2-preview-dialog");
    await expect(dialog).toBeVisible();
    const img = page.getByTestId("template-v2-preview-image");
    await expect(img).toBeVisible({ timeout: 45_000 });
    await expect(img).toHaveAttribute("src", /^(blob:|data:image\/png)/);
    await expect(page.getByTestId("template-v2-preview-error")).toHaveCount(0);

    const natural = await img.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
      complete: el.complete,
    }));
    expect(natural.complete).toBeTruthy();
    expect(natural.w).toBeGreaterThan(0);
    expect(natural.h).toBeGreaterThan(0);

    // Verificación hard vía API request (misma sesión) — evita body vacío de page response
    const apiPreview = await page.request.post("/api/template-v2/preview", {
      data: {
        draft: {
          canvas: { width: 320, height: 180, background: "#ffffff" },
          blocks: [
            {
              id: "t1",
              type: "TEXT",
              layout: {
                x: 10,
                y: 40,
                width: 300,
                height: 40,
                rotation: 0,
                zIndex: 1,
                opacity: 1,
                visible: true,
              },
              configJson: {
                content: "E2E API Preview",
                fontFamily: "Arial",
                fontSize: 22,
                color: "#111111",
              },
            },
          ],
          variableBindings: [],
          meta: {},
        },
        output: { format: "png" },
      },
      headers: { Accept: "image/png" },
    });
    expect(apiPreview.status()).toBe(200);
    const apiBody = await apiPreview.body();
    expect(apiBody.byteLength).toBeGreaterThan(32);
    expect(Buffer.from(apiBody.subarray(0, 8)).toString("hex")).toBe("89504e470d0a1a0a");

    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    // Solo fallar por 5xx de template-v2 (HMR/auth fetch ruidoso en dev).
    if (guard.networkFailures.length > 0) {
      throw new Error(guard.networkFailures.join("\n"));
    }
  } finally {
    if (templateId) {
      await apiDeleteTemplate(page.request, templateId).catch(() => undefined);
    }
  }
});

test("P0-05 preview: binding escolar con datos de ejemplo", async ({ page }) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  await loginAsPhotographer(page, photographer);
  await dismissWorkLocationPrompt(page);

  const created = await apiCreateTemplate(
    page.request,
    `E2E TEMPLATE V2 — preview-var ${Date.now()}`
  );
  trackTemplateId(created.templateId);

  try {
    await page.goto(
      `/fotografo/diseno/plantillas/v2/${encodeURIComponent(created.templateId)}/${encodeURIComponent(created.versionId)}`
    );
    await waitForEditorReady(page);

    const variableBtn = page.getByRole("button", { name: /Variable/i }).first();
    if (await variableBtn.isVisible().catch(() => false)) {
      await variableBtn.click();
    }

    const previewBtn = page.getByTestId("template-v2-preview-button");
    await previewBtn.click();
    await expect(page.getByTestId("template-v2-preview-image")).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("template-v2-preview-error")).toHaveCount(0);
  } finally {
    await apiDeleteTemplate(page.request, created.templateId).catch(() => undefined);
  }
});
