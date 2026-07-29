/**
 * Política de upload por concurso.
 * Valores con marcador BORRADOR deben validarse antes de producción.
 */

export const UPLOAD_POLICY_DRAFT_MARKER = "BORRADOR — VALIDAR ANTES DE PRODUCCIÓN";

export type UploadPolicy = {
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFileSizeBytes: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  minMegapixels: number;
  requireExif: boolean;
  requireCaptureDate: boolean;
  requireGps: boolean;
  allowEditedFiles: boolean;
  maxEntriesPerRegistration: number;
  allowReplaceUntilSubmissionClose: boolean;
  /** Si true, el concurso no debe publicarse en producción sin revisión. */
  draftConfig: boolean;
  notes?: string;
};

/** Defaults temporales Santa Fe en Foco — NO definitivos legales. */
export const SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT: UploadPolicy = {
  allowedMimeTypes: ["image/jpeg"],
  allowedExtensions: ["jpg", "jpeg"],
  maxFileSizeBytes: 25 * 1024 * 1024,
  minWidth: 1200,
  minHeight: 800,
  maxWidth: 12000,
  maxHeight: 12000,
  minMegapixels: 1.5,
  requireExif: false,
  requireCaptureDate: false,
  requireGps: false,
  allowEditedFiles: true,
  maxEntriesPerRegistration: 1,
  allowReplaceUntilSubmissionClose: true,
  draftConfig: true,
  notes: UPLOAD_POLICY_DRAFT_MARKER,
};

export function parseUploadPolicy(raw: unknown): UploadPolicy {
  if (!raw || typeof raw !== "object") {
    return { ...SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT };
  }
  const o = raw as Partial<UploadPolicy>;
  const base = { ...SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT };
  return {
    ...base,
    ...o,
    allowedMimeTypes: Array.isArray(o.allowedMimeTypes)
      ? o.allowedMimeTypes.map(String)
      : base.allowedMimeTypes,
    allowedExtensions: Array.isArray(o.allowedExtensions)
      ? o.allowedExtensions.map((e) => String(e).toLowerCase().replace(/^\./, ""))
      : base.allowedExtensions,
    draftConfig: o.draftConfig ?? base.draftConfig,
  };
}

export function assertUploadPolicySafeForProduction(policy: UploadPolicy): void {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (!isProd) return;
  if (policy.draftConfig || policy.notes?.includes(UPLOAD_POLICY_DRAFT_MARKER)) {
    throw new Error(
      `uploadPolicyJson contiene configuración ${UPLOAD_POLICY_DRAFT_MARKER} — bloqueado en producción.`,
    );
  }
}
