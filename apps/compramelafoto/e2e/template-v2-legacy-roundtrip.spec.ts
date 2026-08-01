import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { e2eRunId, e2eTemplateName, getPhotographerA, hasE2ECredentials } from "./env";
import { loginViaApi } from "./helpers/auth";
import {
  apiCreateTemplate,
  apiDeleteTemplate,
  apiGetSave,
  apiPutSave,
} from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";

const runId = e2eRunId();
const fixturePath = resolve(__dirname, "fixtures/legacy-school-payload.json");

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("round-trip legacy → persistencia → lectura preserva campos conocidos", async ({
  request,
}) => {
  const a = getPhotographerA();
  await loginViaApi(request, a);

  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    canvas: Record<string, unknown>;
    blocks: unknown[];
    variableBindings: unknown[];
    meta: Record<string, unknown>;
  };

  const created = await apiCreateTemplate(
    request,
    e2eTemplateName(runId, "legacy"),
    fixture
  );
  trackTemplateId(created.templateId);

  try {
    const loaded = await apiGetSave(request, created.templateId, created.versionId);
    expect(loaded.ok).toBeTruthy();
    expect(loaded.canvas?.width).toBe(1080);
    expect(loaded.canvas?.height).toBe(1350);
    expect((loaded.blocks ?? []).length).toBe(fixture.blocks.length);

    const text = (loaded.blocks ?? []).find((b) => b.type === "TEXT");
    expect(String(text?.configJson?.content ?? "")).toBe("E2E ORIGINAL");
    expect(text?.configJson?.fontSize).toBe(48);

    const variable = (loaded.blocks ?? []).find((b) => b.type === "VARIABLE_TEXT");
    expect(String(variable?.configJson?.variableKey ?? "")).toBe("student.fullName");

    const bindings = loaded.variableBindings as Array<{ variableKey?: string }> | undefined;
    expect((bindings ?? []).some((b) => b.variableKey === "student.fullName")).toBeTruthy();

    // Re-save sin cambios estructurales
    const again = await apiPutSave(request, created.templateId, created.versionId, {
      revision: Number(loaded.revision ?? 0),
      canvas: loaded.canvas as Record<string, unknown>,
      blocks: loaded.blocks as unknown[],
      variableBindings: loaded.variableBindings as unknown[],
      meta: (loaded.meta as Record<string, unknown>) ?? fixture.meta,
    });
    expect(again.status).toBeLessThan(400);

    const reloaded = await apiGetSave(request, created.templateId, created.versionId);
    expect((reloaded.blocks ?? []).length).toBe(fixture.blocks.length);
    expect(String((reloaded.blocks ?? []).find((b) => b.type === "TEXT")?.configJson?.content)).toBe(
      "E2E ORIGINAL"
    );
  } finally {
    await apiDeleteTemplate(request, created.templateId).catch(() => undefined);
  }
});
