import type { APIRequestContext, APIResponse } from "@playwright/test";
import type { SchoolE2EConfig } from "./school-fixtures";

export async function loginPhotographer(request: APIRequestContext, cfg: SchoolE2EConfig): Promise<void> {
  const res = await request.post("/api/auth/login", {
    data: {
      email: cfg.photographerEmail,
      password: cfg.photographerPassword,
    },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`Login falló ${res.status()}: ${text.slice(0, 500)}`);
  }
}

export function selectionUrl(cfg: SchoolE2EConfig): string {
  return `/api/dashboard/albums/${cfg.albumId}/precompra/order-items/${cfg.orderItemId}/selection`;
}

export function designProjectBase(cfg: SchoolE2EConfig, designProjectId: number): string {
  return `/api/dashboard/albums/${cfg.albumId}/design-projects/${designProjectId}`;
}

export async function postSelection(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  photoIds: number[]
): Promise<APIResponse> {
  return request.post(selectionUrl(cfg), {
    data: { photoIds },
    headers: { "Content-Type": "application/json" },
  });
}

export async function getPreviewStatus(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<{ previewStatus: string; previewDirty: boolean; previewUrl: string | null }> {
  const res = await request.get(`${designProjectBase(cfg, designProjectId)}/preview/status`);
  assertOk(res, "preview/status");
  return res.json() as Promise<{ previewStatus: string; previewDirty: boolean; previewUrl: string | null }>;
}

export async function postPreviewRegenerate(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<APIResponse> {
  return request.post(`${designProjectBase(cfg, designProjectId)}/preview/regenerate`, {
    headers: { "Content-Type": "application/json" },
    data: {},
  });
}

export async function postApprove(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<APIResponse> {
  return request.post(`${designProjectBase(cfg, designProjectId)}/approve`, {
    headers: { "Content-Type": "application/json" },
    data: {},
  });
}

export async function postExport(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<APIResponse> {
  return request.post(`${designProjectBase(cfg, designProjectId)}/export`, {
    headers: { "Content-Type": "application/json" },
    data: {},
  });
}

export async function getExportStatus(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<{ status: string; exportUrlJpg: string | null }> {
  const res = await request.get(`${designProjectBase(cfg, designProjectId)}/export/status`);
  assertOk(res, "export/status");
  return res.json() as Promise<{ status: string; exportUrlJpg: string | null }>;
}

export async function getEditorContext(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<Record<string, unknown>> {
  const res = await request.get(`${designProjectBase(cfg, designProjectId)}/editor/context`);
  assertOk(res, "editor/context");
  return res.json() as Promise<Record<string, unknown>>;
}

export async function fetchDesignProjectIdFromDesignTasks(
  request: APIRequestContext,
  cfg: SchoolE2EConfig
): Promise<number | null> {
  const res = await request.get(`/api/dashboard/albums/${cfg.albumId}/design-tasks`);
  if (!res.ok()) return null;
  const data = (await res.json()) as {
    tasks?: Array<{ orderItemId: number; designProjectId: number | null }>;
  };
  const task = data.tasks?.find((t) => t.orderItemId === cfg.orderItemId);
  return task?.designProjectId ?? null;
}

function assertOk(res: APIResponse, label: string): void {
  if (!res.ok()) {
    throw new Error(`${label} HTTP ${res.status()}`);
  }
}

/** Poll hasta preview READY y no dirty, o timeout. Requiere worker/cron de preview en staging. */
export async function waitForPreviewReady(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<boolean> {
  const deadline = Date.now() + cfg.previewReadyTimeoutMs;
  const intervalMs = 4000;
  while (Date.now() < deadline) {
    const j = await getPreviewStatus(request, cfg, designProjectId);
    if (j.previewStatus === "READY" && !j.previewDirty) return true;
    if (j.previewStatus === "FAILED") return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/** Poll hasta EXPORTED o timeout. Requiere worker/cron de export. */
export async function waitForExportDone(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<boolean> {
  const deadline = Date.now() + cfg.exportDoneTimeoutMs;
  const intervalMs = 5000;
  while (Date.now() < deadline) {
    const j = await getExportStatus(request, cfg, designProjectId);
    if (j.status === "EXPORTED" && j.exportUrlJpg) return true;
    if (j.status !== "EXPORTING") {
      /* puede haber fallado y vuelto a APPROVED_FOR_EXPORT */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
