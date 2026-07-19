export type TestLayer = "domain" | "repository" | "security" | "ui" | "integration";

export type CatalogTestCase = {
  id: string;
  layer: TestLayer;
  title: string;
};

export const CATALOG_TEST_MATRIX: readonly CatalogTestCase[] = [
  { id: "D01", layer: "domain", title: "crear ticket válido" },
  { id: "D02", layer: "domain", title: "precio cero (cortesía)" },
  { id: "D03", layer: "domain", title: "capacidad ilimitada (null)" },
  { id: "D04", layer: "domain", title: "fechas inválidas (end < start)" },
  { id: "D05", layer: "domain", title: "sede de otra edición" },
  { id: "D06", layer: "domain", title: "código duplicado en edición" },
  { id: "D07", layer: "domain", title: "composición válida con variante seleccionable" },
  { id: "D08", layer: "domain", title: "variante de otro producto rechazada" },
  { id: "D09", layer: "domain", title: "stock negativo rechazado" },
  { id: "D10", layer: "domain", title: "precio float rechazado" },
  { id: "R01", layer: "repository", title: "create/update/list ticket" },
  { id: "R02", layer: "repository", title: "filtros edición y sede" },
  { id: "R03", layer: "repository", title: "transacción replaceTicketTypeItems" },
  { id: "R04", layer: "repository", title: "activación soft isActive" },
  { id: "R05", layer: "repository", title: "sin borrado físico de product usado" },
  { id: "S01", layer: "security", title: "usuario no autenticado" },
  { id: "S02", layer: "security", title: "usuario sin rol admin" },
  { id: "S03", layer: "security", title: "administrador allowlist" },
  { id: "S04", layer: "security", title: "venue admin futuro denegado en precios" },
  { id: "U01", layer: "ui", title: "estado vacío sin productos" },
  { id: "U02", layer: "ui", title: "creación entrada" },
  { id: "U03", layer: "ui", title: "edición con errores de campo" },
  { id: "U04", layer: "ui", title: "confirmación desactivar con ventas" },
  { id: "I01", layer: "integration", title: "Prisma local descartable" },
  { id: "I02", layer: "integration", title: "no escribir Neon en tests" },
  { id: "I03", layer: "integration", title: "snapshots registration no alterados" },
] as const;
