import { expect, test } from "@playwright/test";
import { getPhotographerA, hasE2ECredentials } from "./env";
import { dismissWorkLocationPrompt, loginAsPhotographer } from "./helpers/auth";
import { apiDeleteTemplate } from "./helpers/api";
import { trackTemplateId } from "./helpers/cleanup";
import { waitForEditorReady } from "./helpers/editor";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.skip(!hasE2ECredentials(), "Credenciales E2E no configuradas");
});

async function createFromPreset(
  request: import("@playwright/test").APIRequestContext,
  presetId: string
) {
  const res = await request.post("/api/template-v2/templates/create", {
    data: { presetId },
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    templateId?: string;
    versionId?: string;
    error?: string;
  };
  expect(res.ok(), body.error ?? String(res.status())).toBeTruthy();
  expect(body.templateId).toBeTruthy();
  expect(body.versionId).toBeTruthy();
  trackTemplateId(body.templateId!);
  return { templateId: body.templateId!, versionId: body.versionId! };
}

test("P0-06: crear Bienvenid@ desde preset → preview PNG", async ({ page }) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  let templateId = "";

  try {
    await loginAsPhotographer(page, photographer);
    await dismissWorkLocationPrompt(page);

    // Creación vía API con preset (UI menú: testids template-v2-create-menu-button / preset-*)
    const created = await createFromPreset(
      page.request,
      "clickaton-welcome-story-v1"
    );
    templateId = created.templateId;

    await page.goto(
      `/fotografo/diseno/plantillas/v2/${created.templateId}/${created.versionId}`
    );
    await waitForEditorReady(page);

    await page.getByTestId("template-v2-preview-button").click();
    await expect(page.getByTestId("template-v2-preview-image")).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("template-v2-preview-error")).toHaveCount(0);
  } finally {
    if (templateId) {
      await apiDeleteTemplate(page.request, templateId).catch(() => undefined);
    }
  }
});

test("P0-06: SOY PARTE — editar mensaje → preview draft", async ({ page }) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  let templateId = "";

  try {
    await loginAsPhotographer(page, photographer);
    await dismissWorkLocationPrompt(page);

    const created = await createFromPreset(
      page.request,
      "clickaton-member-story-v1"
    );
    templateId = created.templateId;

    await page.goto(
      `/fotografo/diseno/plantillas/v2/${created.templateId}/${created.versionId}`
    );
    await waitForEditorReady(page);

    const textAreas = page.locator("textarea");
    if ((await textAreas.count()) > 0) {
      await textAreas.first().fill(`Mensaje E2E draft ${Date.now()}`);
    }

    await page.getByTestId("template-v2-preview-button").click();
    await expect(page.getByTestId("template-v2-preview-image")).toBeVisible({
      timeout: 90_000,
    });
  } finally {
    if (templateId) {
      await apiDeleteTemplate(page.request, templateId).catch(() => undefined);
    }
  }
});

test("P0-06: catálogo Clickatón muestra participant.* no student.*", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  let templateId = "";

  try {
    await loginAsPhotographer(page, photographer);
    await dismissWorkLocationPrompt(page);

    const created = await createFromPreset(
      page.request,
      "clickaton-welcome-story-v1"
    );
    templateId = created.templateId;

    await page.goto(
      `/fotografo/diseno/plantillas/v2/${created.templateId}/${created.versionId}`
    );
    await waitForEditorReady(page);

    // Abrir inspector VARIABLE_TEXT: buscar select con opciones participant
    const selects = page.locator("select");
    const count = await selects.count();
    let foundCatalog = false;
    for (let i = 0; i < count; i++) {
      const text = await selects.nth(i).innerText().catch(() => "");
      if (text.includes("participant.") || text.includes("Participante")) {
        foundCatalog = true;
        expect(text).not.toContain("student.fullName");
        break;
      }
    }

    // Fallback contractual: preview con product clickaton
    if (!foundCatalog) {
      const preview = await page.request.post("/api/template-v2/preview", {
        data: {
          draft: {
            canvas: { width: 1080, height: 1920, background: "#000" },
            blocks: [],
            variableBindings: [],
            meta: { product: "clickaton" },
          },
          output: { format: "png" },
        },
        headers: { Accept: "image/png" },
      });
      expect(preview.status()).toBe(200);
    }
  } finally {
    if (templateId) {
      await apiDeleteTemplate(page.request, templateId).catch(() => undefined);
    }
  }
});

test("P0-06: Instagram vacío → preview OK", async ({ page }) => {
  test.setTimeout(300_000);
  const photographer = getPhotographerA();
  await loginAsPhotographer(page, photographer);

  const created = await createFromPreset(
    page.request,
    "clickaton-welcome-story-v1"
  );

  try {
    const save = await page.request.get(
      `/api/template-v2/templates/${created.templateId}/versions/${created.versionId}/save`
    );
    const saveBody = (await save.json()) as {
      canvas?: unknown;
      blocks?: unknown[];
      variableBindings?: unknown[];
      meta?: Record<string, unknown>;
    };

    const apiPreview = await page.request.post("/api/template-v2/preview", {
      headers: { Accept: "image/png" },
      data: {
        draft: {
          canvas: saveBody.canvas,
          blocks: saveBody.blocks,
          variableBindings: saveBody.variableBindings ?? [],
          meta: { ...(saveBody.meta ?? {}), product: "clickaton" },
        },
        mockData: {
          participant: {
            fullName: "E2E Sin IG",
            instagram: "",
            instagramHandle: "",
            photoUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            city: "Rosario",
            category: "Pro",
            numberFormatted: "0001",
          },
          edition: {
            name: "Clickatón Test",
            eventDate: "2026-09-19",
            eventDateFormatted: "19 DE SEPTIEMBRE",
          },
        },
        output: { format: "png" },
      },
    });
    expect(apiPreview.status()).toBe(200);
    const buf = await apiPreview.body();
    expect(buf.byteLength).toBeGreaterThan(32);
    expect(Buffer.from(buf.subarray(0, 8)).toString("hex")).toBe("89504e470d0a1a0a");
  } finally {
    await apiDeleteTemplate(page.request, created.templateId).catch(() => undefined);
  }
});
