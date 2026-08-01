import { OrderValidationError } from "./errors.js";

/** Practical email shape for Orders payer.email — not a full RFC parser. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePayerEmail(raw: string | undefined | null): string {
  if (raw == null) {
    throw new OrderValidationError("PAYER_EMAIL_REQUIRED: payer.email is required");
  }
  const email = raw.trim();
  if (!email) {
    throw new OrderValidationError("PAYER_EMAIL_REQUIRED: payer.email is empty");
  }
  if (email.length > 254) {
    throw new OrderValidationError("PAYER_EMAIL_INVALID: payer.email exceeds max length");
  }
  if (!EMAIL_RE.test(email)) {
    throw new OrderValidationError("PAYER_EMAIL_INVALID: payer.email format is invalid");
  }
  return email;
}
