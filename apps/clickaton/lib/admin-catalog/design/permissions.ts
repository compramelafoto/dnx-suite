import {
  CATALOG_ROLE_CAPABILITIES,
  type CatalogAdminCapability,
  type CatalogOperatorRole,
} from "./contracts";

/** MVP: un solo rol efectivo = allowlist / SUPER_ADMIN actual. */
export const MVP_CATALOG_ROLE: CatalogOperatorRole = "ADMIN_GENERAL";

export function roleHasCatalogCapability(
  role: CatalogOperatorRole,
  capability: CatalogAdminCapability,
): boolean {
  return CATALOG_ROLE_CAPABILITIES[role].includes(capability);
}

export const CATALOG_PERMISSION_NOTES = {
  mvp:
    "Reusar hasClickatonAdminAccess (SUPER_ADMIN | allowlist). Sin roles por sede en 10D3B.",
  venueAdminFuture:
    "VENUE_ADMIN_FUTURE: catalog.read + availability; stock local opcional; nunca precios globales ni otras sedes.",
  noSilentExpansion:
    "No ampliar allowlist ni capabilities sin etapa de seguridad dedicada.",
} as const;
