export type TemplateV2ErrorCode =
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_FORBIDDEN"
  | "TEMPLATE_INVALID"
  | "TEMPLATE_IN_USE"
  | "TEMPLATE_PAYLOAD_TOO_LARGE"
  | "TEMPLATE_BINDING_INVALID"
  | "TEMPLATE_ASSET_INVALID"
  | "TEMPLATE_SCHEMA_UNSUPPORTED"
  | "TEMPLATE_EDIT_CONFLICT"
  | "TEMPLATE_PUBLISHED_LOCKED"
  | "TEMPLATE_UNAUTHORIZED"
  | "PREVIEW_NOT_IMPLEMENTED"
  | "TEMPLATE_PREVIEW_INVALID"
  | "TEMPLATE_PREVIEW_ASSET_FAILED"
  | "TEMPLATE_PREVIEW_LIMIT_EXCEEDED"
  | "TEMPLATE_PREVIEW_TIMEOUT"
  | "TEMPLATE_PREVIEW_UNAVAILABLE"
  | "TEMPLATE_PREVIEW_BUSY";

export class TemplateV2DomainError extends Error {
  readonly code: TemplateV2ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: TemplateV2ErrorCode,
    message: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(message);
    this.name = "TemplateV2DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function httpStatusForCode(code: TemplateV2ErrorCode): number {
  switch (code) {
    case "TEMPLATE_UNAUTHORIZED":
      return 401;
    case "TEMPLATE_FORBIDDEN":
    case "TEMPLATE_PUBLISHED_LOCKED":
      return 403;
    case "TEMPLATE_NOT_FOUND":
      return 404;
    case "TEMPLATE_EDIT_CONFLICT":
    case "TEMPLATE_IN_USE":
      return 409;
    case "TEMPLATE_PAYLOAD_TOO_LARGE":
      return 413;
    case "TEMPLATE_INVALID":
    case "TEMPLATE_BINDING_INVALID":
    case "TEMPLATE_ASSET_INVALID":
    case "TEMPLATE_SCHEMA_UNSUPPORTED":
    case "TEMPLATE_PREVIEW_INVALID":
    case "TEMPLATE_PREVIEW_ASSET_FAILED":
    case "TEMPLATE_PREVIEW_LIMIT_EXCEEDED":
      return 422;
    case "TEMPLATE_PREVIEW_BUSY":
      return 429;
    case "TEMPLATE_PREVIEW_UNAVAILABLE":
      return 503;
    case "TEMPLATE_PREVIEW_TIMEOUT":
      return 504;
    case "PREVIEW_NOT_IMPLEMENTED":
      return 501;
    default:
      return 500;
  }
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: { ok: false; error: string; code?: string; details?: unknown };
} {
  if (err instanceof TemplateV2DomainError) {
    return {
      status: err.httpStatus,
      body: {
        ok: false,
        error: err.message,
        code: err.code,
        details: err.details,
      },
    };
  }
  // Errores del renderer compartido (@repo/template-engine-renderer)
  if (
    err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === "TemplateRenderError" &&
    "httpStatus" in err &&
    "code" in err
  ) {
    const e = err as unknown as {
      httpStatus: number;
      message: string;
      code: string;
      details?: unknown;
    };
    return {
      status: e.httpStatus,
      body: {
        ok: false,
        error: e.message,
        code: e.code,
        details: e.details,
      },
    };
  }
  console.error("[template-v2]", err);
  return {
    status: 500,
    body: { ok: false, error: "Error interno de plantillas" },
  };
}
