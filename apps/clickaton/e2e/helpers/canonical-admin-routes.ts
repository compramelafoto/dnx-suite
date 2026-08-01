/** Rutas canónicas administradoras usadas por smoke E2E de staging. */
export const CANONICAL_ADMIN_ROUTES = {
  home: "/admin",
  registrations: "/admin/inscripciones",
  financePartner: "/admin/finanzas/mi-cuenta",
  financeOwner: "/admin/finanzas/cuenta-owner",
  integrationsDiagnostics: "/admin/integraciones/diagnostico",
} as const;
