import { expect, test } from "@playwright/test";
import { e2eRunId, e2eTemplateName, getPhotographerA, hasE2ECredentials } from "./env";
import { loginViaApi } from "./helpers/auth";
import {
  apiCreateTemplate,
  apiDeleteTemplate,
  apiPutSave,
  apiValidate,
  buildSeedPayload,
} from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";

const runId = e2eRunId();

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

test("variables: student.fullName y alumno OK; bindings peligrosos rechazados", async ({
  request,
}) => {
  const a = getPhotographerA();
  await loginViaApi(request, a);

  const created = await apiCreateTemplate(request, e2eTemplateName(runId, "vars"));
  trackTemplateId(created.templateId);

  try {
    const base = buildSeedPayload({ text: "{alumno}" });
    // TEXT con alias legacy + VARIABLE_TEXT con student.fullName
    const okSave = await apiPutSave(request, created.templateId, created.versionId, {
      revision: 0,
      ...base,
    });
    expect(okSave.status).toBeLessThan(400);

    const okValidate = await apiValidate(request, created.templateId);
    expect(okValidate.status).toBe(200);
    expect(okValidate.body.valid).toBeTruthy();

    const dangerousKeys = ["__proto__.polluted", "constructor.prototype"];
    for (const badKey of dangerousKeys) {
      const draft = buildSeedPayload({}) as ReturnType<typeof buildSeedPayload> & {
        blocks: Array<Record<string, unknown>>;
        variableBindings: Array<Record<string, unknown>>;
      };
      draft.blocks = draft.blocks.map((b) => {
        if (b.type !== "VARIABLE_TEXT") return b;
        return {
          ...b,
          configJson: { ...(b.configJson as object), variableKey: badKey },
        };
      });
      draft.variableBindings = [
        {
          id: "bad-bind",
          blockId: String(draft.blocks.find((b) => b.type === "VARIABLE_TEXT")?.id ?? ""),
          targetPath: "variableKey",
          variableKey: badKey,
        },
      ];

      const badValidate = await apiValidate(request, created.templateId, draft);
      // Debe rechazar (422 o valid:false con errores)
      const rejected =
        badValidate.status === 422 ||
        badValidate.body.valid === false ||
        badValidate.status === 400;
      expect(rejected, `expected reject for ${badKey}: ${JSON.stringify(badValidate.body).slice(0, 400)}`).toBeTruthy();

      const badSave = await apiPutSave(request, created.templateId, created.versionId, {
        revision: Number(okSave.body.revision ?? 1),
        ...draft,
      });
      expect(
        badSave.status >= 400,
        `dangerous save should fail for ${badKey}: ${badSave.status}`
      ).toBeTruthy();
    }
  } finally {
    await apiDeleteTemplate(request, created.templateId).catch(() => undefined);
  }
});
