export type CheckoutErrorCode =
  | "CHECKOUT_NOT_AVAILABLE"
  | "PAYMENT_ORDER_EXISTS"
  | "PAYMENT_ORDER_NOT_FOUND"
  | "PAYMENT_ALREADY_APPROVED"
  | "PAYMENT_PENDING"
  | "PAYMENT_REJECTED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_CONFLICT"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_CURRENCY_MISMATCH"
  | "PROVIDER_UNAVAILABLE"
  | "REGISTRATION_EXPIRED"
  | "REGISTRATION_NOT_PAYABLE"
  | "HOLD_CONFLICT"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNEXPECTED";

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: CheckoutErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.details = details;
  }
}

export function toSerializableCheckoutError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof CheckoutError) {
    return { code: error.code, message: error.message };
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error
  ) {
    const code = (error as { code: string }).code;
    const message = String((error as { message: unknown }).message);
    const allowed = new Set<string>([
      "TOKEN_INVALID",
      "TOKEN_EXPIRED",
      "REGISTRATION_EXPIRED",
      "REGISTRATION_NOT_PAYABLE",
      "HOLD_CONFLICT",
      "NOT_FOUND",
      "FORBIDDEN",
      "IDEMPOTENCY_CONFLICT",
      "CHECKOUT_NOT_AVAILABLE",
      "PROVIDER_UNAVAILABLE",
    ]);
    if (allowed.has(code)) {
      return { code, message };
    }
  }
  // Surface vault / provider fail-closed codes without leaking tokens.
  if (error instanceof Error) {
    const m = error.message;
    if (/VAULT_DECRYPT_FAILED|LIVE_PAYMENTS_DISABLED|mercado_pago_production_forbidden/i.test(m)) {
      return { code: "CHECKOUT_NOT_AVAILABLE", message: m.slice(0, 160) };
    }
  }
  return {
    code: "UNEXPECTED",
    message: "No pudimos procesar el pago. Intentá de nuevo en unos minutos.",
  };
}
