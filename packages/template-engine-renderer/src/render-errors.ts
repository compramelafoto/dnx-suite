export type TemplateRenderErrorCode =
  | "TEMPLATE_PREVIEW_INVALID"
  | "TEMPLATE_PREVIEW_ASSET_FAILED"
  | "TEMPLATE_PREVIEW_LIMIT_EXCEEDED"
  | "TEMPLATE_PREVIEW_TIMEOUT"
  | "TEMPLATE_PREVIEW_UNAVAILABLE"
  | "TEMPLATE_PREVIEW_FORMAT_UNSUPPORTED"
  | "TEMPLATE_PREVIEW_BUSY";

export class TemplateRenderError extends Error {
  readonly code: TemplateRenderErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: TemplateRenderErrorCode,
    message: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(message);
    this.name = "TemplateRenderError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function previewInvalid(message: string, details?: unknown) {
  return new TemplateRenderError("TEMPLATE_PREVIEW_INVALID", message, 422, details);
}

export function previewLimitExceeded(message: string, details?: unknown) {
  return new TemplateRenderError(
    "TEMPLATE_PREVIEW_LIMIT_EXCEEDED",
    message,
    422,
    details
  );
}

export function previewAssetFailed(message: string, details?: unknown) {
  return new TemplateRenderError(
    "TEMPLATE_PREVIEW_ASSET_FAILED",
    message,
    422,
    details
  );
}

export function previewTimeout(message = "Timeout generando preview") {
  return new TemplateRenderError("TEMPLATE_PREVIEW_TIMEOUT", message, 504);
}

export function previewUnavailable(message = "Renderer de preview no disponible") {
  return new TemplateRenderError("TEMPLATE_PREVIEW_UNAVAILABLE", message, 503);
}

export function previewBusy(message = "Demasiados previews en curso") {
  return new TemplateRenderError("TEMPLATE_PREVIEW_BUSY", message, 429);
}
