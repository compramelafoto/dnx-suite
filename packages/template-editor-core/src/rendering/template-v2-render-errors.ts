import { TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";
import {
  previewInvalid as sharedPreviewInvalid,
  previewLimitExceeded as sharedPreviewLimitExceeded,
  previewAssetFailed as sharedPreviewAssetFailed,
  previewTimeout as sharedPreviewTimeout,
  previewUnavailable as sharedPreviewUnavailable,
  previewBusy as sharedPreviewBusy,
  TemplateRenderError,
} from "@repo/template-engine-renderer";

export type TemplatePreviewErrorCode =
  | "TEMPLATE_PREVIEW_INVALID"
  | "TEMPLATE_PREVIEW_ASSET_FAILED"
  | "TEMPLATE_PREVIEW_LIMIT_EXCEEDED"
  | "TEMPLATE_PREVIEW_TIMEOUT"
  | "TEMPLATE_PREVIEW_UNAVAILABLE"
  | "TEMPLATE_PREVIEW_FORMAT_UNSUPPORTED"
  | "TEMPLATE_PREVIEW_BUSY";

/**
 * Errores de preview tipados para HTTP CLF (extiende TemplateV2DomainError).
 * El renderer compartido lanza TemplateRenderError; este wrapper mantiene compat.
 */
export class TemplatePreviewError extends TemplateV2DomainError {
  constructor(
    code: TemplatePreviewErrorCode | TemplateV2DomainError["code"],
    message: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(code as TemplateV2DomainError["code"], message, httpStatus, details);
    this.name = "TemplatePreviewError";
  }
}

export function mapTemplateRenderError(err: unknown): TemplatePreviewError | null {
  if (!(err instanceof TemplateRenderError)) return null;
  return new TemplatePreviewError(
    err.code as TemplatePreviewErrorCode,
    err.message,
    err.httpStatus,
    err.details
  );
}

export function previewInvalid(message: string, details?: unknown) {
  void sharedPreviewInvalid;
  return new TemplatePreviewError("TEMPLATE_PREVIEW_INVALID", message, 422, details);
}

export function previewLimitExceeded(message: string, details?: unknown) {
  void sharedPreviewLimitExceeded;
  return new TemplatePreviewError(
    "TEMPLATE_PREVIEW_LIMIT_EXCEEDED",
    message,
    422,
    details
  );
}

export function previewAssetFailed(message: string, details?: unknown) {
  void sharedPreviewAssetFailed;
  return new TemplatePreviewError(
    "TEMPLATE_PREVIEW_ASSET_FAILED",
    message,
    422,
    details
  );
}

export function previewTimeout(message = "Timeout generando preview") {
  void sharedPreviewTimeout;
  return new TemplatePreviewError("TEMPLATE_PREVIEW_TIMEOUT", message, 504);
}

export function previewUnavailable(message = "Renderer de preview no disponible") {
  void sharedPreviewUnavailable;
  return new TemplatePreviewError("TEMPLATE_PREVIEW_UNAVAILABLE", message, 503);
}

export function previewBusy(message = "Demasiados previews en curso") {
  void sharedPreviewBusy;
  return new TemplatePreviewError("TEMPLATE_PREVIEW_BUSY", message, 429);
}
