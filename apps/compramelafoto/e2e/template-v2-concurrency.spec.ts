import { expect, test } from "@playwright/test";
import { TEMPLATE_V2_REVISION_CONFLICT_MESSAGE } from "../lib/template-v2/revision-conflict";
import { e2eRunId, e2eTemplateName, getPhotographerA, hasE2ECredentials } from "./env";
import { loginAsPhotographer, newAuthenticatedContext } from "./helpers/auth";
import {
  apiCreateTemplate,
  apiDeleteTemplate,
  apiGetSave,
  apiPutSave,
  buildSeedPayload,
} from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";
import { waitForEditorReady } from "./helpers/editor";

const runId = e2eRunId();

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("conflicto de revisión: pestaña B recibe 409 y UI no sobrescribe", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const photographer = getPhotographerA();
  await loginAsPhotographer(page, photographer);
  const api = page.request;

  const created = await apiCreateTemplate(
    api,
    e2eTemplateName(runId, "conflict"),
    buildSeedPayload({ text: "REV1" })
  );
  trackTemplateId(created.templateId);
  const { templateId, versionId } = created;

  try {
    // Tab A: carga editor revision actual
    const loadA = page.waitForResponse(
      (r) =>
        r.url().includes(`/versions/${versionId}/save`) &&
        r.request().method() === "GET"
    );
    await page.goto(`/fotografo/diseno/plantillas/v2/${templateId}/${versionId}`, {
      waitUntil: "domcontentloaded",
    });
    const loadARes = await loadA;
    expect(loadARes.ok(), await loadARes.text()).toBeTruthy();
    await waitForEditorReady(page);

    const loadedA = await apiGetSave(api, templateId, versionId);
    const revA = Number(loadedA.revision ?? 0);

    // Tab B (otro contexto): misma revisión
    const tabB = await newAuthenticatedContext(browser, photographer, baseURL!);
    const loadB = tabB.page.waitForResponse(
      (r) =>
        r.url().includes(`/versions/${versionId}/save`) &&
        r.request().method() === "GET"
    );
    await tabB.page.goto(`/fotografo/diseno/plantillas/v2/${templateId}/${versionId}`, {
      waitUntil: "domcontentloaded",
    });
    const loadBRes = await loadB;
    expect(loadBRes.ok(), await loadBRes.text()).toBeTruthy();
    await waitForEditorReady(tabB.page);

    // A guarda → revision+1 vía API (simula guardado exitoso de A)
    const saveA = await apiPutSave(api, templateId, versionId, {
      revision: revA,
      canvas: loadedA.canvas ?? buildSeedPayload({}).canvas,
      blocks: (loadedA.blocks ?? []).map((b) =>
        b.type === "TEXT"
          ? { ...b, configJson: { ...(b.configJson ?? {}), content: "REV2-FROM-A" } }
          : b
      ),
      variableBindings: (loadedA.variableBindings as unknown[]) ?? [],
      meta: (loadedA.meta as Record<string, unknown>) ?? {},
    });
    expect(saveA.status).toBeLessThan(400);
    expect(Number(saveA.body.revision)).toBe(revA + 1);

    // B intenta guardar con revisión obsoleta (API)
    const conflictApi = await apiPutSave(tabB.context.request, templateId, versionId, {
      revision: revA,
      canvas: loadedA.canvas ?? buildSeedPayload({}).canvas,
      blocks: (loadedA.blocks ?? []).map((b) =>
        b.type === "TEXT"
          ? { ...b, configJson: { ...(b.configJson ?? {}), content: "SHOULD-NOT-WIN" } }
          : b
      ),
      variableBindings: (loadedA.variableBindings as unknown[]) ?? [],
      meta: (loadedA.meta as Record<string, unknown>) ?? {},
    });
    expect(conflictApi.status).toBe(409);
    expect(conflictApi.body.error).toBe("revision_conflict");

    const after = await apiGetSave(api, templateId, versionId);
    const text = (after.blocks ?? []).find((b) => b.type === "TEXT");
    expect(String(text?.configJson?.content ?? "")).toBe("REV2-FROM-A");

    // UI de B: forzar dirty + save → banner, sin sobrescribir
    await tabB.page.getByRole("button", { name: "Forma", exact: true }).first().click();
    const saveBtn = tabB.page.getByTestId("template-v2-save-button");
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });

    const uiSave = tabB.page.waitForResponse(
      (r) =>
        r.url().includes(`/versions/${versionId}/save`) &&
        r.request().method() === "PUT"
    );
    await saveBtn.click();
    const uiResp = await uiSave;
    expect(uiResp.status()).toBe(409);

    await expect(tabB.page.getByTestId("template-v2-error-banner")).toContainText(
      TEMPLATE_V2_REVISION_CONFLICT_MESSAGE
    );
    await expect(tabB.page.getByTestId("template-v2-conflict-reload")).toBeVisible();

    const final = await apiGetSave(api, templateId, versionId);
    const finalText = (final.blocks ?? []).find((b) => b.type === "TEXT");
    expect(String(finalText?.configJson?.content ?? "")).toBe("REV2-FROM-A");

    await tabB.context.close();
  } finally {
    await apiDeleteTemplate(api, templateId).catch(() => undefined);
  }
});
