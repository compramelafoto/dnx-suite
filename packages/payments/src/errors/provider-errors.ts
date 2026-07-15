/**
 * Domain-level payment provider errors.
 * Sanitized messages must never include Bearer tokens or raw access tokens.
 */

const SENSITIVE_PATTERNS = [
  /Bearer\s+\S+/gi,
  /TEST-[A-Za-z0-9_-]+/g,
  /APP_USR-[A-Za-z0-9_-]+/g,
  /Authorization:\s*\S+/gi,
];

export function sanitizeProviderMessage(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export class PaymentProviderError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(opts: {
    code: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(sanitizeProviderMessage(opts.message));
    this.name = "PaymentProviderError";
    this.code = opts.code;
    if (opts.statusCode !== undefined) {
      this.statusCode = opts.statusCode;
    }
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      this.cause = opts.cause;
    }
  }
}

function buildProviderErrorOpts(
  code: string,
  message: string,
  retryable: boolean,
  statusCode?: number,
): { code: string; message: string; retryable: boolean; statusCode?: number } {
  return statusCode === undefined
    ? { code, message, retryable }
    : { code, message, retryable, statusCode };
}

export class PaymentProviderAuthError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_AUTH", message, false, statusCode));
    this.name = "PaymentProviderAuthError";
  }
}

export class PaymentProviderValidationError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_VALIDATION", message, false, statusCode));
    this.name = "PaymentProviderValidationError";
  }
}

export class PaymentProviderConflictError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_CONFLICT", message, false, statusCode));
    this.name = "PaymentProviderConflictError";
  }
}

export class PaymentProviderRateLimitError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_RATE_LIMIT", message, true, statusCode));
    this.name = "PaymentProviderRateLimitError";
  }
}

export class PaymentProviderTemporaryError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_TEMPORARY", message, true, statusCode));
    this.name = "PaymentProviderTemporaryError";
  }
}

export class PaymentProviderUnknownError extends PaymentProviderError {
  constructor(message: string, statusCode?: number) {
    super(buildProviderErrorOpts("PROVIDER_UNKNOWN", message, false, statusCode));
    this.name = "PaymentProviderUnknownError";
  }
}

export class ConsentNotActiveError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "CONSENT_NOT_ACTIVE", message, retryable: false });
    this.name = "ConsentNotActiveError";
  }
}

export class RecipientNotEligibleError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "RECIPIENT_NOT_ELIGIBLE", message, retryable: false });
    this.name = "RecipientNotEligibleError";
  }
}

export class ProductionWriteBlockedError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "PRODUCTION_WRITE_BLOCKED", message, retryable: false });
    this.name = "ProductionWriteBlockedError";
  }
}

/** Alias for Mercado Pago sandbox safety guard. */
export class MercadoPagoProductionWriteBlockedError extends ProductionWriteBlockedError {
  constructor(message = "Mercado Pago write operations are blocked in production environment") {
    super(message);
    this.name = "MercadoPagoProductionWriteBlockedError";
  }
}

export class NotImplementedForSafetyError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "NOT_IMPLEMENTED_FOR_SAFETY", message, retryable: false });
    this.name = "NotImplementedForSafetyError";
  }
}
