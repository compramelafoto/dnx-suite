export type CatalogErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "STATE"
  | "CAPACITY"
  | "STOCK"
  | "EDITION_MISMATCH"
  | "DUPLICATE_CODE"
  | "DUPLICATE_SKU"
  | "IMMUTABLE_FIELD";

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CatalogErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
    this.details = details;
  }
}

export class CatalogUnauthorizedError extends CatalogError {
  constructor(message = "Sesión requerida.") {
    super("UNAUTHORIZED", message);
    this.name = "CatalogUnauthorizedError";
  }
}

export class CatalogForbiddenError extends CatalogError {
  constructor(message = "No tenés permisos para administrar el catálogo.") {
    super("FORBIDDEN", message);
    this.name = "CatalogForbiddenError";
  }
}

export class CatalogNotFoundError extends CatalogError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", id ? `${entity} no encontrado: ${id}` : `${entity} no encontrado.`, {
      entity,
      id,
    });
    this.name = "CatalogNotFoundError";
  }
}

export class CatalogValidationError extends CatalogError {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "Datos inválidos.") {
    super("VALIDATION", message, { fieldErrors });
    this.fieldErrors = fieldErrors;
    this.name = "CatalogValidationError";
  }
}

export class CatalogConflictError extends CatalogError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, details);
    this.name = "CatalogConflictError";
  }
}

export class CatalogStateError extends CatalogError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("STATE", message, details);
    this.name = "CatalogStateError";
  }
}

export class CatalogCapacityError extends CatalogError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CAPACITY", message, details);
    this.name = "CatalogCapacityError";
  }
}

export class CatalogStockError extends CatalogError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("STOCK", message, details);
    this.name = "CatalogStockError";
  }
}

export class CatalogEditionMismatchError extends CatalogError {
  constructor(message = "La sede o el producto no pertenecen a la edición.") {
    super("EDITION_MISMATCH", message);
    this.name = "CatalogEditionMismatchError";
  }
}

export class CatalogDuplicateCodeError extends CatalogError {
  constructor(scope: string, code: string) {
    super("DUPLICATE_CODE", `Código duplicado en ${scope}: ${code}`, { scope, code });
    this.name = "CatalogDuplicateCodeError";
  }
}

export class CatalogDuplicateSkuError extends CatalogError {
  constructor(sku: string) {
    super("DUPLICATE_SKU", `SKU ya en uso: ${sku}`, { sku });
    this.name = "CatalogDuplicateSkuError";
  }
}

export class CatalogImmutableFieldError extends CatalogError {
  constructor(fields: string[]) {
    super(
      "IMMUTABLE_FIELD",
      `Campos bloqueados por inscripciones confirmadas: ${fields.join(", ")}. Duplicá la entrada.`,
      { fields },
    );
    this.name = "CatalogImmutableFieldError";
  }
}

export function toSerializableCatalogError(error: unknown): {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
} {
  if (error instanceof CatalogError) {
    return {
      code: error.code,
      message: error.message,
      fieldErrors: error instanceof CatalogValidationError ? error.fieldErrors : undefined,
      details: error.details,
    };
  }
  return { code: "INTERNAL", message: "Error interno del catálogo." };
}
