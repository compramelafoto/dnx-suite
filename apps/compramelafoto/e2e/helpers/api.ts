import { expect, type APIRequestContext } from "@playwright/test";

export type TemplateCreateResult = {
  templateId: string;
  versionId: string;
  name: string;
};

export type SavePayload = {
  revision: number;
  canvas: Record<string, unknown>;
  blocks: unknown[];
  variableBindings?: unknown[];
  meta?: Record<string, unknown>;
};

export async function apiCreateTemplate(
  request: APIRequestContext,
  name: string,
  payload?: unknown
): Promise<TemplateCreateResult> {
  const res = await request.post("/api/template-v2/templates", {
    data: { name, ...(payload ? { payload } : {}) },
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    templateId?: string;
    versionId?: string;
    meta?: { templateId?: string; versionId?: string; name?: string };
    error?: string;
  };
  expect(res.ok(), `create failed: ${body.error ?? res.status()}`).toBeTruthy();
  const templateId = body.templateId ?? body.meta?.templateId;
  const versionId = body.versionId ?? body.meta?.versionId;
  expect(templateId).toBeTruthy();
  expect(versionId).toBeTruthy();
  return { templateId: templateId!, versionId: versionId!, name: body.meta?.name ?? name };
}

export async function apiGetSave(
  request: APIRequestContext,
  templateId: string,
  versionId: string
) {
  const res = await request.get(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`
  );
  const body = await res.json();
  expect(res.ok(), `get save failed: ${JSON.stringify(body).slice(0, 300)}`).toBeTruthy();
  return body as {
    ok: boolean;
    revision?: number;
    canvas?: Record<string, unknown>;
    blocks?: Array<{ id: string; type: string; configJson?: Record<string, unknown>; layout?: Record<string, unknown> }>;
    variableBindings?: unknown[];
    meta?: Record<string, unknown>;
    name?: string;
  };
}

export async function apiPutSave(
  request: APIRequestContext,
  templateId: string,
  versionId: string,
  payload: SavePayload
) {
  const res = await request.put(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`,
    { data: payload }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiValidate(
  request: APIRequestContext,
  templateId: string,
  draft?: unknown
) {
  const res = await request.post(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/validate`,
    { data: draft ?? {} }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiDuplicate(
  request: APIRequestContext,
  templateId: string,
  name?: string
) {
  const res = await request.post(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/duplicate`,
    { data: name ? { name } : {} }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiDeleteTemplate(request: APIRequestContext, templateId: string) {
  const res = await request.delete(`/api/template-v2/templates/${encodeURIComponent(templateId)}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiGetTemplate(request: APIRequestContext, templateId: string) {
  const res = await request.get(`/api/template-v2/templates/${encodeURIComponent(templateId)}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiPatchTemplate(
  request: APIRequestContext,
  templateId: string,
  data: Record<string, unknown>
) {
  const res = await request.patch(`/api/template-v2/templates/${encodeURIComponent(templateId)}`, {
    data,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiListVersions(request: APIRequestContext, templateId: string) {
  const res = await request.get(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions`
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export async function apiSaveAsNewVersion(
  request: APIRequestContext,
  templateId: string,
  payload: SavePayload & { branchFromVersionId?: string }
) {
  const res = await request.post(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/save-as-new-version`,
    { data: payload }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Record<string, unknown> };
}

export function buildSeedPayload(opts: {
  text?: string;
  width?: number;
  height?: number;
}) {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1350;
  const textId = `e2e-text-${Date.now()}`;
  const varId = `e2e-var-${Date.now()}`;
  const shapeId = `e2e-shape-${Date.now()}`;
  const bgId = `e2e-bg-${Date.now()}`;
  return {
    canvas: { width, height, background: "#ffffff", dpi: 300, safeAreaMm: 5 },
    blocks: [
      {
        id: bgId,
        type: "BACKGROUND",
        pageIndex: 0,
        name: "Fondo",
        layout: {
          x: 0,
          y: 0,
          width,
          height,
          rotation: 0,
          zIndex: 0,
          opacity: 1,
          locked: true,
          visible: true,
        },
        configJson: { backgroundColor: "#ffffff", src: "", fit: "cover" },
      },
      {
        id: textId,
        type: "TEXT",
        pageIndex: 0,
        name: "Texto E2E",
        layout: {
          x: 80,
          y: 120,
          width: 800,
          height: 60,
          rotation: 0,
          zIndex: 2,
          opacity: 1,
          locked: false,
          visible: true,
        },
        configJson: {
          content: opts.text ?? "E2E ORIGINAL",
          fontFamily: "Helvetica",
          fontSize: 42,
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: 0,
          textAlign: "CENTER",
          color: "#111827",
        },
      },
      {
        id: varId,
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Variable",
        layout: {
          x: 80,
          y: 220,
          width: 800,
          height: 50,
          rotation: 0,
          zIndex: 3,
          opacity: 1,
          locked: false,
          visible: true,
        },
        configJson: {
          variableKey: "student.fullName",
          fallback: "Nombre",
          fontFamily: "Helvetica",
          fontSize: 36,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: 0,
          textAlign: "CENTER",
          color: "#334155",
        },
      },
      {
        id: shapeId,
        type: "SHAPE",
        pageIndex: 0,
        name: "Forma",
        layout: {
          x: 200,
          y: 400,
          width: 420,
          height: 140,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
          locked: false,
          visible: true,
        },
        configJson: {
          variant: "rectangle",
          fill: "#e2e8f0",
          stroke: "#64748b",
          strokeWidth: 2,
          cornerRadius: 8,
        },
      },
    ],
    variableBindings: [
      {
        id: `bind-${varId}`,
        blockId: varId,
        targetPath: "variableKey",
        variableKey: "student.fullName",
      },
    ],
    meta: { templatePageCount: 1, e2e: true },
  };
}
