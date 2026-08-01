import { expect, test } from "@playwright/test";
import { e2eRunId, e2eTemplateName, getPhotographerA, getPhotographerB, hasE2ECredentials } from "./env";
import { loginViaApi, newAuthenticatedContext } from "./helpers/auth";
import {
  apiCreateTemplate,
  apiDeleteTemplate,
  apiDuplicate,
  apiGetTemplate,
  apiPutSave,
  buildSeedPayload,
} from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";

const runId = e2eRunId();

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("aislamiento: B no lee/escribe/duplica/elimina plantilla privada de A", async ({
  browser,
  request,
  baseURL,
}) => {
  const a = getPhotographerA();
  const b = getPhotographerB();

  await loginViaApi(request, a);
  const created = await apiCreateTemplate(
    request,
    e2eTemplateName(runId, "owner-a"),
    buildSeedPayload({ text: "PRIVADO-A" })
  );
  trackTemplateId(created.templateId);

  const ctxB = await newAuthenticatedContext(browser, b, baseURL!);
  try {
    // A puede leer
    const readA = await apiGetTemplate(request, created.templateId);
    expect(readA.status).toBe(200);
    expect(readA.body.ok).toBeTruthy();

    // B: GET → 404 (recurso inexistente / no filtrado)
    const readB = await apiGetTemplate(ctxB.context.request, created.templateId);
    expect(readB.status).toBe(404);

    // B: PUT save → 404
    const saveB = await apiPutSave(ctxB.context.request, created.templateId, created.versionId, {
      revision: 0,
      ...buildSeedPayload({ text: "HACK-B" }),
    });
    expect(saveB.status).toBe(404);

    // B: duplicate → 404
    const dupB = await apiDuplicate(ctxB.context.request, created.templateId);
    expect(dupB.status).toBe(404);

    // B: delete → 404
    const delB = await apiDeleteTemplate(ctxB.context.request, created.templateId);
    expect(delB.status).toBe(404);

    // B no puede abrir editor (UI)
    await ctxB.page.goto(
      `/fotografo/diseno/plantillas/v2/${created.templateId}/${created.versionId}`,
      { waitUntil: "domcontentloaded" }
    );
    // El editor muestra error de carga o no queda usable; no debe mostrar canvas listo
    const errorVisible = await ctxB.page
      .getByText(/no encontr|sin permiso|no se pudo|error/i)
      .first()
      .isVisible()
      .catch(() => false);
    const canvasReady = await ctxB.page
      .getByTestId("template-v2-canvas")
      .isVisible()
      .catch(() => false);
    expect(errorVisible || !canvasReady).toBeTruthy();

    // A sigue pudiendo borrar
    const delA = await apiDeleteTemplate(request, created.templateId);
    expect(delA.status).toBeLessThan(400);
  } finally {
    await ctxB.context.close();
    await apiDeleteTemplate(request, created.templateId).catch(() => undefined);
  }
});
