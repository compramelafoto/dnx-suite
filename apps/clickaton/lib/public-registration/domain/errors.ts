export type PublicRegistrationErrorCode =
  | "EDITION_NOT_AVAILABLE"
  | "VENUE_NOT_AVAILABLE"
  | "TICKET_NOT_AVAILABLE"
  | "SALE_NOT_STARTED"
  | "SALE_ENDED"
  | "CAPACITY_EXCEEDED"
  | "PRODUCT_OUT_OF_STOCK"
  | "VARIANT_REQUIRED"
  | "INVALID_VARIANT"
  | "DUPLICATE_REGISTRATION"
  | "IDEMPOTENCY_CONFLICT"
  | "CONSENT_REQUIRED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
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
  return {
    code: "UNEXPECTED",
    message: "No pudimos completar la inscripción. Intentá de nuevo en unos minutos.",
  };
}
