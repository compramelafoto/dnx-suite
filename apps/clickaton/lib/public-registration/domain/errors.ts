export type PublicRegistrationErrorCode =
  | "EDITION_NOT_AVAILABLE"
  | "VENUE_NOT_AVAILABLE"
  | "TICKET_NOT_AVAILABLE"
  | "SALE_NOT_STARTED"
  | "SALE_ENDED"
  | "CAPACITY_EXCEEDED"
  | "PHASE_CAPACITY_EXCEEDED"
  | "PRODUCT_OUT_OF_STOCK"
  | "VARIANT_REQUIRED"
  | "INVALID_VARIANT"
  | "DUPLICATE_REGISTRATION"
  | "IDEMPOTENCY_CONFLICT"
  | "CONSENT_REQUIRED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "REGISTRATION_EXPIRED"
  | "REGISTRATION_NOT_PAYABLE"
  | "HOLD_ALREADY_RELEASED"
  | "HOLD_CONFLICT"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "RATE_LIMITED"
  | "UNEXPECTED";

export class PublicRegistrationError extends Error {
  readonly code: PublicRegistrationErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(
    code: PublicRegistrationErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PublicRegistrationError";
    this.code = code;
    this.details = details;
  }
}

export class PublicRegistrationValidationError extends PublicRegistrationError {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "Revisá los datos del formulario.") {
    super("VALIDATION", message, { fieldErrors });
    this.fieldErrors = fieldErrors;
  }
}

export function toSerializablePublicRegistrationError(error: unknown): {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
} {
  if (error instanceof PublicRegistrationError) {
    return {
      code: error.code,
      message: error.message,
      fieldErrors:
        error instanceof PublicRegistrationValidationError ? error.fieldErrors : undefined,
    };
  }

  // Finanzas / distribución: mensaje seguro para participantes (sin enums ni IDs internos).
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "NO_ACTIVE_DISTRIBUTION"
  ) {
    return {
      code: "EDITION_NOT_AVAILABLE",
      message:
        "Esta edición todavía no puede cobrar inscripciones. Probá de nuevo más tarde o contactá a la organización.",
    };
  }
  if (error instanceof Error) {
    const m = error.message;
    if (/NO_ACTIVE_DISTRIBUTION|distribuci[oó]n ACTIVE|snapshot_requires_payment_account/i.test(m)) {
      return {
        code: "EDITION_NOT_AVAILABLE",
        message:
          "Esta edición todavía no puede cobrar inscripciones. Probá de nuevo más tarde o contactá a la organización.",
      };
    }
  }

  return {
    code: "UNEXPECTED",
    message:
      "No pudimos completar la inscripción. Si el problema continúa, contactá a la organización e indicá que falló al reservar tu lugar.",
  };
}
