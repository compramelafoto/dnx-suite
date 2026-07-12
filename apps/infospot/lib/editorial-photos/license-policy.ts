/**
 * Política de licencia editorial CLF → Info Spot.
 *
 * Producción: NUNCA default AUTHORIZED sin contrato explícito.
 * Staging: solo con INFOSPOT_ALLOW_STAGING_EDITORIAL_LICENSE=1.
 */

export type EditorialLicenseDefault = "PENDING" | "AUTHORIZED" | "UNKNOWN";

/**
 * ¿Hay respaldo contractual para autorizar difusión editorial automática?
 * Requiere flag explícito de contrato (independiente del default de staging).
 */
export function hasEditorialLicenseContract(): boolean {
  return process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT === "1";
}

function treatAsProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY === "1"
  );
}

/**
 * Default al crear InfoSpotEditorialPhoto.
 * - Producción: siempre PENDING salvo CONTRACT=1 y DEFAULT=AUTHORIZED.
 * - Staging/dev: AUTHORIZED solo con ALLOW_STAGING=1 (o DEFAULT=AUTHORIZED).
 */
export function resolveDefaultEditorialLicenseStatus(): EditorialLicenseDefault {
  const isProd = treatAsProduction();
  const envDefault = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT?.trim().toUpperCase();

  if (isProd) {
    // Bloqueo explícito: no honorar DEFAULT=AUTHORIZED sin contrato.
    if (envDefault === "AUTHORIZED" && hasEditorialLicenseContract()) {
      return "AUTHORIZED";
    }
    if (envDefault === "UNKNOWN") return "UNKNOWN";
    return "PENDING";
  }

  if (envDefault === "AUTHORIZED") return "AUTHORIZED";
  if (envDefault === "UNKNOWN") return "UNKNOWN";
  if (envDefault === "PENDING") return "PENDING";

  if (process.env.INFOSPOT_ALLOW_STAGING_EDITORIAL_LICENSE === "1") {
    return "AUTHORIZED";
  }
  return "PENDING";
}

/**
 * Bloquea autorización masiva / default inseguro en producción.
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
        "Producción: INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT=AUTHORIZED requiere INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=1 (términos CLF).",
    };
  }
  return { ok: true };
}
