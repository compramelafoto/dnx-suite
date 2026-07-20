export type AdminRegistrationErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_STATUS_TRANSITION"
  | "CAPACITY_EXCEEDED"
  | "REGISTRATION_CONFLICT"
  | "EDITION_MISMATCH"
  | "VENUE_MISMATCH"
  | "TICKET_MISMATCH"
  | "INVALID_ASSIGNMENT"
  | "ALREADY_CANCELLED"
  | "ALREADY_CONFIRMED";

export class AdminRegistrationError extends Error {
  readonly code: AdminRegistrationErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(
    code: AdminRegistrationErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AdminRegistrationError";
    this.code = code;
    this.details = details;
  }
}

export class AdminRegistrationUnauthorizedError extends AdminRegistrationError {
  constructor(message = "Sesión requerida.") {
    super("UNAUTHORIZED", message);
  }
}

export class AdminRegistrationForbiddenError extends AdminRegistrationError {
  constructor(message = "No tenés permisos para administrar inscripciones.") {
    super("FORBIDDEN", message);
  }
}

export class AdminRegistrationNotFoundError extends AdminRegistrationError {
  constructor(id?: string) {
    super("NOT_FOUND", id ? `Inscripción no encontrada: ${id}` : "Inscripción no encontrada.", {
      id,
    });
  }
}

export class AdminRegistrationValidationError extends AdminRegistrationError {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "Datos inválidos.") {
    super("VALIDATION", message, { fieldErrors });
    this.fieldErrors = fieldErrors;
  }
}

export class AdminRegistrationTransitionError extends AdminRegistrationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_STATUS_TRANSITION", message, details);
  }
}

export function toSerializableAdminRegistrationError(error: unknown): {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
} {
  if (error instanceof AdminRegistrationError) {
    return {
      code: error.code,
      message: error.message,
      fieldErrors:
        error instanceof AdminRegistrationValidationError ? error.fieldErrors : undefined,
      details: error.details,
    };
  }
  return { code: "INTERNAL", message: "Error interno de inscripciones." };
}
