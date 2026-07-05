/**
 * Versiones de documentos legales aceptados en checkout de compra de fotos (cliente final).
 * LEGAL-PACK-2026-06 — sin migración dedicada; auditoría vía OrderAuditLog.
 */

/** Términos cliente final en /terminos (sección Cliente final). */
export const CUSTOMER_CHECKOUT_TERMS_VERSION = "CUSTOMER-TERMS-v1";

/** Política de privacidad pública en /privacidad. */
export const PRIVACY_POLICY_VERSION = "PRIVACY-v1";

export type CheckoutTermsAcceptancePayload = {
  termsAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
};

export function buildCheckoutTermsAcceptanceMetadata(
  acceptedAt: Date = new Date()
): Record<string, unknown> {
  return {
    termsAccepted: true,
    termsVersion: CUSTOMER_CHECKOUT_TERMS_VERSION,
    privacyVersion: PRIVACY_POLICY_VERSION,
    termsAcceptedAt: acceptedAt.toISOString(),
    documents: {
      termsUrl: "/terminos",
      privacyUrl: "/privacidad",
    },
  };
}
