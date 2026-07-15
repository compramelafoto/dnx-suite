import {
  ConsentNotActiveError,
  PaymentProviderAuthError,
  PaymentProviderConflictError,
  PaymentProviderRateLimitError,
  PaymentProviderTemporaryError,
  PaymentProviderUnknownError,
  PaymentProviderValidationError,
  RecipientNotEligibleError,
  sanitizeProviderMessage,
} from "../../../errors/provider-errors.js";
import type { Rfc7807Problem } from "../client/mercado-pago-response.js";
import {
  extractMpErrorCodes,
  extractMpErrorMessage,
  type MercadoPagoErrorBody,
} from "./mercado-pago-error.js";

const CONSENT_NOT_ACTIVE_CODES = new Set([
  "CONSENT_NOT_ACTIVE",
  "CONSENT_INACTIVE",
  "CONSENT_EXPIRED",
  "CONSENT_REJECTED",
  "CONSENT_CANCELED",
]);

const RECIPIENT_NOT_ELIGIBLE_CODES = new Set([
  "RECIPIENT_NOT_ELIGIBLE",
  "OWNER_MISMATCH",
  "INVALID_RECEIVER",
  "RECEIVER_NOT_FOUND",
]);

const RETRYABLE_STATUS = new Set([423, 429, 500, 502, 503, 504]);

export function mapMercadoPagoHttpError(
  status: number,
  problem: Rfc7807Problem | null,
  body: MercadoPagoErrorBody | null,
): Error {
  const codes = extractMpErrorCodes(problem, body);
  const message = sanitizeProviderMessage(
    extractMpErrorMessage(problem, body, `Mercado Pago request failed with status ${status}`),
  );

  for (const code of codes) {
    if (CONSENT_NOT_ACTIVE_CODES.has(code)) {
      return new ConsentNotActiveError(message);
    }
    if (RECIPIENT_NOT_ELIGIBLE_CODES.has(code)) {
      return new RecipientNotEligibleError(message);
    }
  }

  if (codes.includes("OWNER_MISMATCH")) {
    return new RecipientNotEligibleError(message);
  }

  switch (status) {
    case 400:
    case 422:
      return new PaymentProviderValidationError(message, status);
    case 401:
    case 403:
      return new PaymentProviderAuthError(message, status);
    case 409:
      return new PaymentProviderConflictError(message, status);
    case 429:
      return new PaymentProviderRateLimitError(message, status);
    default:
      if (RETRYABLE_STATUS.has(status)) {
        return new PaymentProviderTemporaryError(message, status);
      }
      return new PaymentProviderUnknownError(message, status);
  }
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}
