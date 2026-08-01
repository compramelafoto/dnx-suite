import { expect, test } from "@playwright/test";
import { e2eRunId, e2eTemplateName, getPhotographerA, hasE2ECredentials } from "./env";
import { loginViaApi } from "./helpers/auth";
import {
  apiCreateTemplate,
  apiDeleteTemplate,
  apiGetSave,
  apiListVersions,
  apiPutSave,
  apiSaveAsNewVersion,
  buildSeedPayload,
} from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";

const runId = e2eRunId();

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("versionado: listar, guardar revisión, crear nueva versión funcional", async ({
  request,
}) => {
  const a = getPhotographerA();
  await loginViaApi(request, a);

  const created = await apiCreateTemplate(
    request,
    e2eTemplateName(runId, "versions"),
    buildSeedPayload({ text: "V1" })
  );
  trackTemplateId(created.templateId);

  try {
    const list1 = await apiListVersions(request, created.templateId);
    expect(list1.status).toBe(200);
    const versions1 = (list1.body.versions ?? list1.body.items ?? []) as Array<{
      id: string;
      versionNumber?: number;
      revision?: number;
    }>;
    expect(versions1.length).toBeGreaterThanOrEqual(1);

    const loaded = await apiGetSave(request, created.templateId, created.versionId);
    const rev0 = Number(loaded.revision ?? 0);

    // Revisión optimista (mismo versionId)
    const saveRev = await apiPutSave(request, created.templateId, created.versionId, {
      revision: rev0,
      canvas: loaded.canvas ?? buildSeedPayload({}).canvas,
      blocks: (loaded.blocks ?? []).map((b) =>
        b.type === "TEXT"
          ? { ...b, configJson: { ...(b.configJson ?? {}), content: "V1-REV2" } }
          : b
      ),
      variableBindings: (loaded.variableBindings as unknown[]) ?? [],
      meta: (loaded.meta as Record<string, unknown>) ?? {},
    });
    expect(saveRev.status).toBeLessThan(400);
    expect(Number(saveRev.body.revision)).toBe(rev0 + 1);

    // Nueva versión funcional (nuevo versionId / versionNumber)
    const newVer = await apiSaveAsNewVersion(request, created.templateId, {
      revision: Number(saveRev.body.revision),
      canvas: loaded.canvas ?? buildSeedPayload({}).canvas,
      blocks: (loaded.blocks ?? []).map((b) =>
        b.type === "TEXT"
          ? { ...b, configJson: { ...(b.configJson ?? {}), content: "V2" } }
          : b
      ),
      variableBindings: (loaded.variableBindings as unknown[]) ?? [],
      meta: (loaded.meta as Record<string, unknown>) ?? {},
      branchFromVersionId: created.versionId,
    });
    expect(newVer.status).toBeLessThan(400);
    const newVersionId = String(newVer.body.versionId ?? "");
    expect(newVersionId).toBeTruthy();
    expect(newVersionId).not.toBe(created.versionId);

    const list2 = await apiListVersions(request, created.templateId);
    const versions2 = (list2.body.versions ?? list2.body.items ?? []) as Array<{ id: string }>;
    expect(versions2.length).toBeGreaterThanOrEqual(2);

    const v1 = await apiGetSave(request, created.templateId, created.versionId);
    const v2 = await apiGetSave(request, created.templateId, newVersionId);
    expect(String((v1.blocks ?? []).find((b) => b.type === "TEXT")?.configJson?.content)).toContain(
      "V1"
    );
    expect(String((v2.blocks ?? []).find((b) => b.type === "TEXT")?.configJson?.content)).toBe("V2");
  } finally {
    await apiDeleteTemplate(request, created.templateId).catch(() => undefined);
  }
});
