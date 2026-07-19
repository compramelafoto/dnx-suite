/**
 * Rutas de diseño 10D3A — catálogo admin.
 * Arquitectura elegida: hub top-level filtrado por edición (patrón sedes).
 */

export const catalogAdminRoutes = {
  hub: "/admin/catalogo",
  tickets: "/admin/catalogo/entradas",
  ticketNew: "/admin/catalogo/entradas/nueva",
  ticketDetail: (ticketTypeId: string) => `/admin/catalogo/entradas/${ticketTypeId}`,
  ticketEdit: (ticketTypeId: string) => `/admin/catalogo/entradas/${ticketTypeId}/editar`,
  products: "/admin/catalogo/productos",
  productNew: "/admin/catalogo/productos/nuevo",
  productDetail: (productId: string) => `/admin/catalogo/productos/${productId}`,
  productEdit: (productId: string) => `/admin/catalogo/productos/${productId}/editar`,
  /** Atajo desde detalle de edición → productos filtrados (10D3C). */
  editionCatalog: (editionId: string) =>
    `/admin/catalogo/productos?editionId=${encodeURIComponent(editionId)}`,
} as const;

export type CatalogRouteArchitecture = {
  primary: "TOP_LEVEL_FILTERED_BY_EDITION";
  editionShortcut: true;
  nestedExclusiveRejectedReason: string;
};

export const CATALOG_ROUTE_ARCHITECTURE: CatalogRouteArchitecture = {
  primary: "TOP_LEVEL_FILTERED_BY_EDITION",
  editionShortcut: true,
  nestedExclusiveRejectedReason:
    "Un catálogo solo anidado en /ediciones/[id]/catalogo dificulta listados multi-filtro y rompe el patrón ya usado por Sedes.",
};
