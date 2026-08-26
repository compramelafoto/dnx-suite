/**
 * Compatibilidad de contratos editor ↔ APIs canónicas.
 * El editor sigue usando paths legacy (`.../save`, `/create`, `/clone`).
 * Las rutas canónicas (`GET/POST /templates`, `duplicate`, `validate`) reutilizan los mismos servicios.
 */

export const TEMPLATE_V2_EDITOR_PATHS = {
  create: "/api/template-v2/templates/create",
  save: (templateId: string, versionId: string) =>
    `/api/template-v2/templates/${templateId}/versions/${versionId}/save`,
  clone: (templateId: string) => `/api/template-v2/templates/${templateId}/clone`,
  versions: (templateId: string) => `/api/template-v2/templates/${templateId}/versions`,
  imageUpload: (templateId: string, versionId: string) =>
    `/api/template-v2/templates/${templateId}/versions/${versionId}/image-upload`,
  saveAsNewVersion: (templateId: string) =>
    `/api/template-v2/templates/${templateId}/save-as-new-version`,
  submitForReview: (templateId: string) =>
    `/api/template-v2/templates/${templateId}/submit-for-review`,
  publicCatalog: "/api/template-v2/public",
  preview: "/api/template-v2/preview",
} as const;

export const TEMPLATE_V2_CANONICAL_PATHS = {
  list: "/api/template-v2/templates",
  create: "/api/template-v2/templates",
  detail: (templateId: string) => `/api/template-v2/templates/${templateId}`,
  duplicate: (templateId: string) => `/api/template-v2/templates/${templateId}/duplicate`,
  validate: (templateId: string) => `/api/template-v2/templates/${templateId}/validate`,
} as const;

/** Respuesta canónica de detalle. */
export type TemplateV2DetailResponseShape = {
  template: unknown; // TemplateDocument
  legacy?: unknown; // editor payload
  compatibilityWarnings: unknown[];
  meta: Record<string, unknown>;
};
