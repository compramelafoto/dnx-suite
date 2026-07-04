/**
 * Configuración E2E módulo escolar (ComprameLaFoto).
 *
 * Preparación automática: `pnpm e2e:prepare` (genera `.env.e2e`; `playwright.config` lo carga).
 *
 * Variables (staging / local):
 * - PLAYWRIGHT_BASE_URL | E2E_BASE_URL — origen de la app (ej. https://staging... o http://127.0.0.1:3002)
 * - E2E_PHOTOGRAPHER_EMAIL — usuario con rol fotógrafo dueño del álbum
 * - E2E_PHOTOGRAPHER_PASSWORD
 * - E2E_SCHOOL_ALBUM_ID — álbum numérico
 * - E2E_SCHOOL_ORDER_ITEM_ID — PreCompraOrderItem en READY_TO_DESIGN o que pase a él tras selección
 * - E2E_SCHOOL_PHOTO_IDS — IDs de fotos del álbum, separados por coma (misma cantidad que exige el producto)
 *
 * Opcional UI:
 * - E2E_SCHOOL_DESIGN_PROJECT_ID — si no querés depender del flujo API en la misma corrida
 *
 * Opcional tiempos:
 * - E2E_PREVIEW_READY_TIMEOUT_MS (default 120000)
 * - E2E_EXPORT_DONE_TIMEOUT_MS (default 180000)
 *
 * Jobs async (preview/export):
 * - E2E_DRAIN_DESIGN_CRON — si true/1, los helpers llaman GET /api/cron/process-design-previews|exports durante el poll (local).
 *   Default: true si PLAYWRIGHT_BASE_URL es localhost/127.0.0.1; false en otros hosts salvo que fuerces true.
 */

export type SchoolE2EConfig = {
  baseURL: string;
  photographerEmail: string;
  photographerPassword: string;
  albumId: number;
  orderItemId: number;
  photoIds: number[];
  /** Para school-review.ui sin correr API antes */
  designProjectIdOverride: number | null;
  previewReadyTimeoutMs: number;
  exportDoneTimeoutMs: number;
  /** Encolar procesamiento vía rutas cron internas durante E2E (no cambia producción). */
  drainDesignCron: boolean;
};

function parseIntStrict(name: string, raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(n) || n <= 0) {
    console.warn(`[school-e2e] ${name} inválido: ${raw}`);
    return null;
  }
  return n;
}

function parsePhotoIds(raw: string | undefined): number[] | null {
  if (raw == null || raw.trim() === "") return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const ids = parts.map((p) => Number.parseInt(p, 10));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return ids;
}

/** Localhost → drenar jobs por defecto; remoto → off salvo E2E_DRAIN_DESIGN_CRON=true. */
export function shouldDrainDesignCronJobs(baseURL: string): boolean {
  const v = process.env.E2E_DRAIN_DESIGN_CRON?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  try {
    const u = new URL(baseURL.includes("://") ? baseURL : `http://${baseURL}`);
    const host = u.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function getSchoolE2EConfig(): SchoolE2EConfig | null {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    process.env.E2E_BASE_URL?.trim() ||
    "http://127.0.0.1:3002";

  const photographerEmail = process.env.E2E_PHOTOGRAPHER_EMAIL?.trim();
  const photographerPassword = process.env.E2E_PHOTOGRAPHER_PASSWORD ?? "";

  const albumId = parseIntStrict("E2E_SCHOOL_ALBUM_ID", process.env.E2E_SCHOOL_ALBUM_ID);
  const orderItemId = parseIntStrict("E2E_SCHOOL_ORDER_ITEM_ID", process.env.E2E_SCHOOL_ORDER_ITEM_ID);
  const photoIds = parsePhotoIds(process.env.E2E_SCHOOL_PHOTO_IDS);

  if (!photographerEmail || !photographerPassword || albumId == null || orderItemId == null || !photoIds?.length) {
    console.warn(
      "[school-e2e] Config incompleta. En local: `pnpm e2e:prepare` (apps/compramelafoto). Ver e2e/env.example."
    );
    return null;
  }

  const designOverride = parseIntStrict("E2E_SCHOOL_DESIGN_PROJECT_ID", process.env.E2E_SCHOOL_DESIGN_PROJECT_ID);

  const previewReadyTimeoutMs = Number.parseInt(process.env.E2E_PREVIEW_READY_TIMEOUT_MS ?? "120000", 10) || 120_000;
  const exportDoneTimeoutMs = Number.parseInt(process.env.E2E_EXPORT_DONE_TIMEOUT_MS ?? "180000", 10) || 180_000;
  const normalizedBase = baseURL.replace(/\/$/, "");

  return {
    baseURL: normalizedBase,
    photographerEmail,
    photographerPassword,
    albumId,
    orderItemId,
    photoIds,
    designProjectIdOverride: designOverride,
    previewReadyTimeoutMs,
    exportDoneTimeoutMs,
    drainDesignCron: shouldDrainDesignCronJobs(normalizedBase),
  };
}
