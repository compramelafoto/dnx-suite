import type { APIRequestContext, APIResponse } from "@playwright/test";
import type { SchoolE2EConfig } from "./school-fixtures";

/**
 * Auth para rutas /api/cron/* en E2E:
 * - Bearer CRON_SECRET si está definido (misma variable que el servidor).
 * - x-cron-dev-bypass: 1 para `next dev` cuando assertCronAuth permite bypass (no producción).
 */
export function buildCronAuthHeadersForE2E(): Record<string, string> {
  const headers: Record<string, string> = { "x-cron-dev-bypass": "1" };
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  return headers;
}

/** Dispara el worker de preview (hasta 15 jobs por request, igual que el cron). */
export async function drainDesignPreviewJobs(request: APIRequestContext): Promise<APIResponse> {
  return request.get("/api/cron/process-design-previews", { headers: buildCronAuthHeadersForE2E() });
}

/** Dispara el worker de export JPG. */
export async function drainDesignExportJobs(request: APIRequestContext): Promise<APIResponse> {
  return request.get("/api/cron/process-design-exports", { headers: buildCronAuthHeadersForE2E() });
}

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

/**
 * Poll hasta preview READY y no dirty.
 * Si cfg.drainDesignCron, entre iteraciones llama al cron interno (mismo handler que Vercel cron).
 */
export async function waitForPreviewReady(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<boolean> {
  const deadline = Date.now() + cfg.previewReadyTimeoutMs;
  const intervalMs = 2500;
  while (Date.now() < deadline) {
    if (cfg.drainDesignCron) {
      const cronRes = await drainDesignPreviewJobs(request);
      if (!cronRes.ok()) {
        const t = await cronRes.text();
        throw new Error(
          `[school-e2e] process-design-previews HTTP ${cronRes.status()}: ${t.slice(0, 400)}. ¿CRON_SECRET alineado con .env.local o next dev?`
        );
      }
    }
    const j = await getPreviewStatus(request, cfg, designProjectId);
    if (j.previewStatus === "READY" && !j.previewDirty) return true;
    if (j.previewStatus === "FAILED") return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Poll hasta EXPORTED con exportUrlJpg.
 * Si cfg.drainDesignCron, dispara process-design-exports entre polls.
 */
export async function waitForExportDone(
  request: APIRequestContext,
  cfg: SchoolE2EConfig,
  designProjectId: number
): Promise<boolean> {
  const deadline = Date.now() + cfg.exportDoneTimeoutMs;
  const intervalMs = 2500;
  while (Date.now() < deadline) {
    if (cfg.drainDesignCron) {
      const cronRes = await drainDesignExportJobs(request);
      if (!cronRes.ok()) {
        const t = await cronRes.text();
        throw new Error(
          `[school-e2e] process-design-exports HTTP ${cronRes.status()}: ${t.slice(0, 400)}. ¿CRON_SECRET alineado con .env.local?`
        );
      }
    }
    const j = await getExportStatus(request, cfg, designProjectId) as {
      status: string;
      exportUrlJpg: string | null;
      exportError?: string | null;
    };
    if (j.status === "EXPORTED" && j.exportUrlJpg) return true;
    if (j.exportError && j.status !== "EXPORTING") return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
