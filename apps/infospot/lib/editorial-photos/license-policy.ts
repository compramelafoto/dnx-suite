/**
 * Política de licencia editorial CLF → Info Spot.
 *
 * Desde TERMS_VERSION álbum CLF 2026-07-21 (y registro fotógrafo v3),
 * el fotógrafo autoriza uso editorial limitado en Info Spot para promover ventas.
 *
 * Kill switch: INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=0
 * Override explícito: CONTRACT=1 (redundante si el contrato de términos está vigente).
 */

export type EditorialLicenseDefault = "PENDING" | "AUTHORIZED" | "UNKNOWN";

/** Versión de términos de álbum CLF que incorpora la cláusula Info Spot. */
export const INFOSPOT_EDITORIAL_TERMS_CONTRACT_SINCE = "2026-07-21";

/**
 * ¿Hay respaldo contractual para autorizar difusión editorial automática?
 * Por defecto sí (términos CLF vigentes). Desactivar solo con CONTRACT=0.
 */
export function hasEditorialLicenseContract(): boolean {
  const flag = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  // Contrato incorporado en photographerTerms / photographerTermsExtended.
  return true;
}

function treatAsProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY === "1"
  );
}

/**
 * Default al crear InfoSpotEditorialPhoto.
 * Con contrato de términos vigente → AUTHORIZED (salvo override env a PENDING/UNKNOWN).
 */
export function resolveDefaultEditorialLicenseStatus(): EditorialLicenseDefault {
  const envDefault = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT?.trim().toUpperCase();
  const contracted = hasEditorialLicenseContract();

  if (!contracted) {
    if (envDefault === "UNKNOWN") return "UNKNOWN";
    return "PENDING";
  }

  if (envDefault === "PENDING") return "PENDING";
  if (envDefault === "UNKNOWN") return "UNKNOWN";
  if (envDefault === "AUTHORIZED") return "AUTHORIZED";

  // Contrato de términos vigente: autorizar por defecto (prod y no-prod).
  return "AUTHORIZED";
}

/**
 * Valida configuración de entorno en producción.
 * CONTRACT=0 es un kill switch válido; DEFAULT=AUTHORIZED sin contrato ya no aplica
 * porque el contrato vive en los términos CLF (salvo kill switch).
 */
export function assertProductionLicensePolicy(): {
  ok: boolean;
  error?: string;
} {
  if (!treatAsProduction()) return { ok: true };
  const envDefault = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT?.trim().toUpperCase();
  if (envDefault === "AUTHORIZED" && !hasEditorialLicenseContract()) {
    return {
      ok: false,
      error:
        "Producción: INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT=AUTHORIZED requiere contrato editorial (términos CLF o INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=1). Kill switch CONTRACT=0 lo bloquea.",
    };
  }
  return { ok: true };
}
