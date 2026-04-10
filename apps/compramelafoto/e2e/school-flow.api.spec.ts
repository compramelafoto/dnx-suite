import { test, expect } from "@playwright/test";
import { getSchoolE2EConfig } from "./helpers/school-fixtures";
import * as schoolApi from "./helpers/school-api";

const cfg = getSchoolE2EConfig();
test.skip(!cfg, "Corré `pnpm e2e:prepare` en apps/compramelafoto o definí variables (e2e/env.example)");

test.describe("school-flow API @school-api", () => {
  const c = cfg!;

  test.describe.configure({ mode: "serial" });

  let designProjectId = 0;

  test("selección persiste y ensure crea diseño (designEnsure.ok)", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const res = await schoolApi.postSelection(request, c, c.photoIds);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      ok: boolean;
      designProjectId: number | null;
      designEnsure?: { ok: boolean; created?: boolean; code?: string; message?: string };
    };
    expect(data.ok).toBe(true);
    expect(data.designEnsure?.ok, `ensure falló: ${JSON.stringify(data.designEnsure)}`).toBe(true);
    expect(data.designProjectId).toBeTruthy();
    designProjectId = data.designProjectId!;
    console.log("[school_design_flow] e2e designProjectId", designProjectId);
  });

  test("idempotencia: segunda selección no duplica proyecto (created=false)", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const res = await schoolApi.postSelection(request, c, c.photoIds);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      ok: boolean;
      designProjectId: number | null;
      designEnsure?: { ok: boolean; created?: boolean };
    };
    expect(data.ok).toBe(true);
    expect(data.designEnsure?.ok).toBe(true);
    expect(data.designEnsure?.created).toBe(false);
    expect(data.designProjectId).toBe(designProjectId);
  });

  test("aprobación bloqueada si preview no está READY", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const status = await schoolApi.getPreviewStatus(request, c, designProjectId);
    if (status.previewStatus === "READY" && !status.previewDirty) {
      test.skip(true, "Preview ya READY; saltar bloqueo de aprobación en este entorno");
    }
    const res = await schoolApi.postApprove(request, c, designProjectId);
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("PREVIEW_NOT_READY");
  });

  test("regenerar preview encola job (200 o 409 si ya hay job activo)", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const res = await schoolApi.postPreviewRegenerate(request, c, designProjectId);
    expect([200, 409]).toContain(res.status());
  });

  test("editor context expone proyecto, revisión y plantilla", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const j = await schoolApi.getEditorContext(request, c, designProjectId);
    expect(j.designProject).toBeDefined();
    expect(j.revision).toBeDefined();
    expect(j.template).toBeDefined();
    expect(Array.isArray(j.slots)).toBeTruthy();
  });

  test("aprobación cuando preview READY (requiere cron/worker preview)", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const ready = await schoolApi.waitForPreviewReady(request, c, designProjectId);
    test.skip(!ready, "Preview no llegó a READY a tiempo; ejecutá cron process-design-previews o aumentá E2E_PREVIEW_READY_TIMEOUT_MS");

    const res = await schoolApi.postApprove(request, c, designProjectId);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  test("export final (requiere aprobación previa y worker export)", async ({ request }) => {
    await schoolApi.loginPhotographer(request, c);
    const status = await schoolApi.getExportStatus(request, c, designProjectId);
    if (status.status !== "APPROVED_FOR_EXPORT") {
      test.skip(true, "Ítem no está APPROVED_FOR_EXPORT; correr test de aprobación antes o estado inconsistente");
    }
    const res = await schoolApi.postExport(request, c, designProjectId);
    expect(res.ok()).toBeTruthy();

    const done = await schoolApi.waitForExportDone(request, c, designProjectId);
    test.skip(!done, "Export no completó a tiempo; ejecutá cron process-design-exports o aumentá E2E_EXPORT_DONE_TIMEOUT_MS");

    const final = await schoolApi.getExportStatus(request, c, designProjectId);
    expect(final.status).toBe("EXPORTED");
    expect(final.exportUrlJpg).toBeTruthy();
  });
});
