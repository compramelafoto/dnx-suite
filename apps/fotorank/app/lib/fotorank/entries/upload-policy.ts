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
  /** Ventana de captura (DateTimeOriginal), no de carga. */
  captureWindowStartsAt?: Date | null;
  captureWindowEndsExclusiveAt?: Date | null;
  /**
   * Override explícito de ventana pública de carga.
   * `undefined` = no forzar; `true`/`false` = abrir/cerrar.
   */
  publicUploadOpen?: boolean;
  /** Si true, el concurso no debe publicarse en producción sin revisión. */
  draftConfig: boolean;
  notes?: string;
};

/**
 * Lee el flag `publicUploadOpen` del JSON de política.
 * `null` = ausente (no fuerza); `true`/`false` = override explícito.
 */
export function isPublicUploadOpenFlag(raw: unknown): boolean | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as { publicUploadOpen?: unknown }).publicUploadOpen;
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

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
  const startsRaw = (o as { captureWindowStartsAt?: unknown }).captureWindowStartsAt;
  const endsRaw = (o as { captureWindowEndsExclusiveAt?: unknown }).captureWindowEndsExclusiveAt;
  return {
    ...base,
    ...o,
    allowedMimeTypes: Array.isArray(o.allowedMimeTypes)
      ? o.allowedMimeTypes.map(String)
      : base.allowedMimeTypes,
    allowedExtensions: Array.isArray(o.allowedExtensions)
      ? o.allowedExtensions.map((e) => String(e).toLowerCase().replace(/^\./, ""))
      : base.allowedExtensions,
    captureWindowStartsAt: startsRaw ? new Date(String(startsRaw)) : (base.captureWindowStartsAt ?? null),
    captureWindowEndsExclusiveAt: endsRaw
      ? new Date(String(endsRaw))
      : (base.captureWindowEndsExclusiveAt ?? null),
    publicUploadOpen:
      typeof o.publicUploadOpen === "boolean" ? o.publicUploadOpen : base.publicUploadOpen,
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

/**
 * ¿El concurso deja que una misma inscripción presente obras en varias
 * categorías? Apagado salvo `true` explícito: cada inscripción queda en la
 * categoría que eligió al anotarse, como siempre.
 */
export function allowsMultipleCategories(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return (raw as { allowMultipleCategories?: unknown }).allowMultipleCategories === true;
}

/**
 * Devuelve la política con el interruptor puesto o sacado, sin tocar el resto.
 * Sobre un concurso sin política crea sólo esta clave: no agrega
 * `maxEntriesPerRegistration`, así el cupo sigue saliendo de cada categoría.
 */
export function withMultipleCategories(raw: unknown, enabled: boolean): Record<string, unknown> {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  if (enabled) base.allowMultipleCategories = true;
  else delete base.allowMultipleCategories;
  return base;
}
