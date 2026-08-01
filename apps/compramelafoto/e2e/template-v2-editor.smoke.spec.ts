import { expect, test } from "@playwright/test";
import { e2eRunId, e2eTemplateName, getPhotographerA, hasE2ECredentials } from "./env";
import { dismissWorkLocationPrompt, loginAsPhotographer } from "./helpers/auth";
import {
  apiDeleteTemplate,
  apiDuplicate,
  apiGetSave,
  apiPatchTemplate,
  apiPutSave,
  apiValidate,
  buildSeedPayload,
} from "./helpers/api";
import { attachConsoleGuard } from "./helpers/console";
import { cleanupE2ETemplatesByPrefix, trackTemplateId } from "./helpers/cleanup";
import { waitForEditorReady } from "./helpers/editor";

const runId = e2eRunId();
const namePrefix = "E2E TEMPLATE V2 —";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("P0-04 smoke: create → edit → save → reload → validate → duplicate", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  const guard = attachConsoleGuard(page);
  const api = page.request;
  const createdIds: string[] = [];

  try {
    // Paso 1 — Auth
    await loginAsPhotographer(page, photographer);
    await expect(page.getByRole("heading", { name: "Plantillas", exact: true })).toBeVisible();
    await dismissWorkLocationPrompt(page);
    const createBtn = page.getByTestId("template-v2-create-button");
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
    // Paso 2 — Crear (UI) con reintento si el primer click cae pre-hidratación
    let createResp = null as Awaited<ReturnType<typeof page.waitForResponse>> | null;
    for (let attempt = 0; attempt < 3 && !createResp; attempt++) {
      try {
        const [resp] = await Promise.all([
          page.waitForResponse(
            (r) =>
              r.url().includes("/api/template-v2/templates/create") &&
              r.request().method() === "POST",
            { timeout: 25_000 }
          ),
          createBtn.click({ force: true }),
        ]);
        createResp = resp;
      } catch {
        // reintento
      }
    }
    expect(createResp, "POST /templates/create no disparó tras reintentos UI").toBeTruthy();
    expect(createResp!.ok()).toBeTruthy();
    const createBody = (await createResp!.json()) as {
      templateId?: string;
      versionId?: string;
    };
    expect(createBody.templateId).toBeTruthy();
    expect(createBody.versionId).toBeTruthy();
    const templateId = createBody.templateId!;
    const versionId = createBody.versionId!;
    createdIds.push(templateId);
    trackTemplateId(templateId);

    await expect(page).toHaveURL(
      new RegExp(`/fotografo/diseno/plantillas/v2/${templateId}/${versionId}`)
    );

    // Paso 3 — Cargar editor
    await waitForEditorReady(page);
    await expect(page.getByTestId("template-v2-save-status")).toBeVisible();

    // Renombrar + sembrar contenido inicial vía API (UI create no pide nombre/dimensiones)
    const seedName = e2eTemplateName(runId, "main");
    await apiPatchTemplate(api, templateId, { name: seedName });
    const seed = buildSeedPayload({ text: "E2E ORIGINAL", width: 1080, height: 1350 });
    const seeded = await apiPutSave(api, templateId, versionId, {
      revision: 0,
      ...seed,
    });
    expect(seeded.status, JSON.stringify(seeded.body).slice(0, 400)).toBeLessThan(400);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForEditorReady(page);
    await expect(page.getByRole("heading", { name: seedName })).toBeVisible();

    // Paso 4 — Editar en UI (Variable/Forma insertan bloques; Texto(T) solo cambia herramienta)
    await page.getByRole("button", { name: "Variable", exact: true }).first().click();
    await page.getByRole("button", { name: "Forma", exact: true }).first().click();

    const editable = page.locator("[contenteditable='true']").first();
    if (await editable.isVisible().catch(() => false)) {
      await editable.dblclick();
      await page.keyboard.press("Meta+A").catch(() => undefined);
      await page.keyboard.type("E2E EDITADO");
    }

    const saveBtn = page.getByTestId("template-v2-save-button");
    if (await saveBtn.isDisabled()) {
      await page.getByRole("button", { name: "Forma", exact: true }).first().click();
    }
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });

    // Paso 5 — Guardar manual
    const saveRespPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/versions/${versionId}/save`) &&
        r.request().method() === "PUT"
    );
    await saveBtn.click();
    const saveResp = await saveRespPromise;
    expect(saveResp.status(), await saveResp.text()).toBeLessThan(400);
    await expect(page.getByTestId("template-v2-save-status")).toContainText(/Guardado/i, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("template-v2-error-banner")).toHaveCount(0);

    // Paso 6 — Recargar y persistencia
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForEditorReady(page);
    const afterReload = await apiGetSave(api, templateId, versionId);
    expect(afterReload.ok).toBeTruthy();
    expect(afterReload.canvas?.width).toBe(1080);
    expect(afterReload.canvas?.height).toBe(1350);
    expect((afterReload.blocks ?? []).length).toBeGreaterThanOrEqual(4);
    const hasVariable = (afterReload.blocks ?? []).some((b) => b.type === "VARIABLE_TEXT");
    expect(hasVariable).toBeTruthy();

    // Paso 7 — Validar (API: no hay botón validate en UI)
    const validation = await apiValidate(api, templateId);
    expect(validation.status).toBe(200);
    expect(validation.body.ok).toBeTruthy();
    expect(validation.body.valid).toBeTruthy();

    // Paso 8 — Duplicar (API: no hay botón duplicate en listado)
    const dupName = e2eTemplateName(runId, "copia");
    const dup = await apiDuplicate(api, templateId, dupName);
    expect(dup.status).toBe(201);
    const dupId = String(dup.body.templateId ?? "");
    const dupVersionId = String(dup.body.versionId ?? "");
    expect(dupId).toBeTruthy();
    expect(dupId).not.toBe(templateId);
    createdIds.push(dupId);
    trackTemplateId(dupId);

    const originalBefore = await apiGetSave(api, templateId, versionId);
    const dupLoaded = await apiGetSave(api, dupId, dupVersionId);
    const origBlockIds = new Set((originalBefore.blocks ?? []).map((b) => b.id));
    for (const b of dupLoaded.blocks ?? []) {
      expect(origBlockIds.has(b.id)).toBeFalsy();
    }

    const dupBlocks = (dupLoaded.blocks ?? []).map((b) =>
      b.type === "TEXT"
        ? {
            ...b,
            configJson: { ...(b.configJson ?? {}), content: "E2E SOLO COPIA" },
          }
        : b
    );
    const dupSave = await apiPutSave(api, dupId, dupVersionId, {
      revision: Number(dupLoaded.revision ?? 0),
      canvas: dupLoaded.canvas ?? seed.canvas,
      blocks: dupBlocks,
      variableBindings: (dupLoaded.variableBindings as unknown[]) ?? [],
      meta: (dupLoaded.meta as Record<string, unknown>) ?? {},
    });
    expect(dupSave.status).toBeLessThan(400);

    const originalAfter = await apiGetSave(api, templateId, versionId);
    const origText = (originalAfter.blocks ?? []).find((b) => b.type === "TEXT");
    expect(String(origText?.configJson?.content ?? "")).not.toBe("E2E SOLO COPIA");

    guard.assertClean();
  } finally {
    for (const id of createdIds) {
      await apiDeleteTemplate(api, id).catch(() => undefined);
    }
    await cleanupE2ETemplatesByPrefix(api, namePrefix).catch(() => 0);
  }
});
