import { OrderValidationError } from "./errors.js";
import { MERCADO_PAGO_STATEMENT_DESCRIPTOR_MAX_LENGTH } from "./constants.js";

/**
 * Sanitize statement descriptor for MP card extract.
 * No PII: reject @, long digit runs (cards/phones), and emails.
 */
export function sanitizeStatementDescriptor(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new OrderValidationError(
      "STATEMENT_DESCRIPTOR_REQUIRED: statement_descriptor is empty",
    );
  }
  if (trimmed.includes("@") || /https?:\/\//i.test(trimmed)) {
    throw new OrderValidationError(
      "STATEMENT_DESCRIPTOR_INVALID: must not contain email or URL",
    );
  }
  if (/\d{8,}/.test(trimmed.replace(/\s+/g, ""))) {
    throw new OrderValidationError(
      "STATEMENT_DESCRIPTOR_INVALID: must not contain long digit sequences (PII risk)",
    );
  }

  const sanitized = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MERCADO_PAGO_STATEMENT_DESCRIPTOR_MAX_LENGTH);

  if (!sanitized) {
    throw new OrderValidationError(
      "STATEMENT_DESCRIPTOR_INVALID: sanitized statement_descriptor is empty",
    );
  }
  return sanitized;
}

export function resolveStatementDescriptor(input: {
  statementDescriptor?: string | null;
  defaultStatementDescriptor?: string | null;
}): string {
  const raw = input.statementDescriptor?.trim() || input.defaultStatementDescriptor?.trim();
  if (!raw) {
    throw new OrderValidationError(
      "STATEMENT_DESCRIPTOR_REQUIRED: provide statementDescriptor or adapter defaultStatementDescriptor",
    );
  }
  return sanitizeStatementDescriptor(raw);
}
