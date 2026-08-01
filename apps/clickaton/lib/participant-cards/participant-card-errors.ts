export type ClickatonCardErrorCode =
  | "CLICKATON_CARD_NOT_FOUND"
  | "CLICKATON_CARD_FORBIDDEN"
  | "CLICKATON_CARD_NOT_ELIGIBLE"
  | "CLICKATON_CARD_PHOTO_REQUIRED"
  | "CLICKATON_CARD_CONSENT_REQUIRED"
  | "CLICKATON_CARD_REGISTRATION_INVALID"
  | "CLICKATON_CARD_TEMPLATE_INVALID"
  | "CLICKATON_CARD_RENDER_FAILED"
  | "CLICKATON_CARD_RENDER_UNAVAILABLE"
  | "CLICKATON_CARD_UNAUTHORIZED"
  | "CLICKATON_CARD_RATE_LIMITED";

const HTTP_STATUS_BY_CODE: Record<ClickatonCardErrorCode, number> = {
  CLICKATON_CARD_NOT_FOUND: 404,
  CLICKATON_CARD_FORBIDDEN: 403,
  CLICKATON_CARD_NOT_ELIGIBLE: 409,
  CLICKATON_CARD_PHOTO_REQUIRED: 422,
  CLICKATON_CARD_CONSENT_REQUIRED: 422,
  CLICKATON_CARD_REGISTRATION_INVALID: 422,
  CLICKATON_CARD_TEMPLATE_INVALID: 422,
  CLICKATON_CARD_RENDER_FAILED: 500,
  CLICKATON_CARD_RENDER_UNAVAILABLE: 503,
  CLICKATON_CARD_UNAUTHORIZED: 401,
  CLICKATON_CARD_RATE_LIMITED: 429,
};

export class ClickatonCardError extends Error {
  readonly code: ClickatonCardErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: ClickatonCardErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ClickatonCardError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function cardNotFound(message = "Inscripción no encontrada", details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_NOT_FOUND", message, details);
}

export function cardForbidden(message = "Acceso denegado", details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_FORBIDDEN", message, details);
}

export function cardNotEligible(message: string, details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_NOT_ELIGIBLE", message, details);
}

export function cardPhotoRequired(message = "Foto de perfil requerida", details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_PHOTO_REQUIRED", message, details);
}

export function cardConsentRequired(
  message = "Consentimiento de imagen o términos requerido",
  details?: unknown
) {
  return new ClickatonCardError("CLICKATON_CARD_CONSENT_REQUIRED", message, details);
}

export function cardRegistrationInvalid(message: string, details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_REGISTRATION_INVALID", message, details);
}

export function cardTemplateInvalid(message: string, details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_TEMPLATE_INVALID", message, details);
}

export function cardRenderFailed(message: string, details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_RENDER_FAILED", message, details);
}

export function cardRenderUnavailable(message: string, details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_RENDER_UNAVAILABLE", message, details);
}

export function cardUnauthorized(message = "Sesión requerida", details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_UNAUTHORIZED", message, details);
}

export function cardRateLimited(message = "Demasiadas solicitudes", details?: unknown) {
  return new ClickatonCardError("CLICKATON_CARD_RATE_LIMITED", message, details);
}
