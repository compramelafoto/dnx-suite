import { OrderValidationError } from "./errors.js";

/**
 * Defensive anti-PII guard for external_reference.
 * Prefer opaque IDs (paymentOrderId, registrationId, UUID).
 * Not a magical PII detector — rejects clear personal data patterns only.
 */
export function assertOpaqueExternalReference(raw: string | undefined | null): string {
  if (raw == null || !raw.trim()) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_REQUIRED: external_reference is required",
    );
  }
  const value = raw.trim();
  if (value.length > 256) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_INVALID: external_reference exceeds max length",
    );
  }
  if (value.includes("@")) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_PII: external_reference must not contain email",
    );
  }
  if (/\b(visa|mastercard|amex)\b/i.test(value)) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_PII: external_reference must not contain card brand/PII tokens",
    );
  }
  // Long digit runs (phones / DNI-like) without an opaque id prefix are rejected.
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length >= 8 && /^[\d\s\-+()]+$/.test(value)) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_PII: external_reference looks like a phone/document number",
    );
  }
  // Reject "Name Surname" style free text (space + letters only, no digits/hyphen/underscore).
  if (/^[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){1,3}$/.test(value) && value.length >= 5) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_PII: external_reference must not be a personal name",
    );
  }
  return value;
}

/**
 * Canonical opaque reference builder for product consumers.
 * Example: buildOpaqueExternalReference("clickaton", "registration", id)
 */
export function buildOpaqueExternalReference(
  sourceProduct: string,
  entity: string,
  id: string,
): string {
  const product = sourceProduct.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "");
  const kind = entity.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "");
  const opaqueId = id.trim();
  if (!product || !kind || !opaqueId) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_INVALID: sourceProduct, entity and id are required",
    );
  }
  if (opaqueId.includes("@")) {
    throw new OrderValidationError(
      "EXTERNAL_REFERENCE_PII: id segment must not contain email",
    );
  }
  return assertOpaqueExternalReference(`${product}-${kind}-${opaqueId}`);
}
