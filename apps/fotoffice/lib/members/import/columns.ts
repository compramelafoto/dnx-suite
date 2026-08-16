/**
 * Fuente única de verdad de las columnas de importación masiva de Socios.
 * El prompt para ChatGPT y la validación del CSV se generan AMBOS a partir
 * de esta lista — nunca hardcodeados por separado, para que no queden
 * desincronizados del schema real (`lib/members/schema.ts`).
 *
 * Deliberadamente NO se incluyen: id, workspaceId, userId, avatarUrl,
 * createdAt, updatedAt, leftAt — son técnicos, derivados o no aplican a un
 * alta nueva (leftAt se completa solo al pasar a INACTIVE, igual que en el
 * alta manual).
 */
export type MemberImportColumn = {
  key: string;
  required: boolean;
  description: string;
};

export const MEMBER_IMPORT_COLUMNS: readonly MemberImportColumn[] = [
  { key: "memberNumber", required: true, description: "Número de socio. Se conserva EXACTO tal como viene (incluidos ceros a la izquierda si los tiene)." },
  { key: "firstName", required: true, description: "Nombre." },
  { key: "lastName", required: true, description: "Apellido." },
  { key: "documentType", required: false, description: "Tipo de documento (ej. DNI, CUIT, Pasaporte)." },
  { key: "documentNumber", required: false, description: "Número de documento." },
  { key: "email", required: false, description: "Email." },
  { key: "phone", required: false, description: "Teléfono." },
  { key: "birthDate", required: false, description: "Fecha de nacimiento, formato AAAA-MM-DD." },
  { key: "address", required: false, description: "Domicilio." },
  { key: "city", required: false, description: "Ciudad." },
  { key: "province", required: false, description: "Provincia." },
  { key: "postalCode", required: false, description: "Código postal." },
  { key: "joinedAt", required: true, description: "Fecha de ingreso, formato AAAA-MM-DD." },
  { key: "status", required: true, description: "Estado: ACTIVE, SUSPENDED o INACTIVE." },
  { key: "category", required: true, description: "Nombre EXACTO de una categoría ya existente en este workspace (no el id técnico)." },
  { key: "notes", required: false, description: "Observaciones internas." },
] as const;

export const MEMBER_IMPORT_HEADER_ROW = MEMBER_IMPORT_COLUMNS.map((c) => c.key).join(",");

export const MEMBER_IMPORT_REQUIRED_COLUMNS = MEMBER_IMPORT_COLUMNS.filter((c) => c.required).map(
  (c) => c.key,
);

export const MEMBER_IMPORT_MAX_ROWS = 500;
