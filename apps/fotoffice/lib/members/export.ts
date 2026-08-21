/**
 * Exportación del padrón a CSV. Módulo PURO: no toca la base ni depende de Prisma, así que
 * las reglas de escapado se pueden probar sin infraestructura.
 *
 * El archivo generado usa EXACTAMENTE el mismo encabezado que espera el importador
 * (`MEMBER_IMPORT_COLUMNS`), para que exportar → editar en una planilla → volver a importar
 * sea un ciclo cerrado. Esa lista es la única fuente de verdad: si mañana se agrega una
 * columna al import, esta exportación la incluye sola.
 */
import { MEMBER_IMPORT_COLUMNS } from "./import/columns";
import { normalizeDocument } from "./documents";
import type { MemberStatus } from "./status-labels";

/**
 * Caracteres que hacen que Excel, LibreOffice o Google Sheets interpreten la celda como una
 * FÓRMULA en vez de texto. Un socio cuyo apellido o nota empiece con `=` podría ejecutar algo
 * al abrir el archivo (CSV injection). No alcanza con las comillas de CSV: el problema aparece
 * después de que la planilla parsea el campo.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutraliza fórmulas anteponiendo una comilla simple, la convención que reconocen las
 * planillas para "esto es texto literal". No se borra ni se altera el dato: se sigue leyendo
 * igual, solo deja de ejecutarse.
 */
export function escapeFormulaInjection(value: string): string {
  if (!value) return value;
  return FORMULA_TRIGGERS.some((t) => value.startsWith(t)) ? `'${value}` : value;
}

/** Escapado CSV estándar (RFC 4180): comillas dobladas y campo entrecomillado si hace falta. */
export function toCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const asText = escapeFormulaInjection(String(raw));
  const needsQuotes = /[",\n\r]/.test(asText);
  const escaped = asText.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/** Fecha en el mismo formato AAAA-MM-DD que exige el importador. */
export function toCsvDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
}

/** Forma mínima que necesita la exportación. No pide el registro completo de Prisma. */
export type ExportableMember = {
  memberNumber: string;
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  joinedAt: Date | null;
  status: string;
  notes: string | null;
  category: { name: string } | null;
};

/**
 * Arma la fila en el orden EXACTO de las columnas del importador. El documento se exporta ya
 * normalizado (solo dígitos en DNI y CUIT/CUIL), que es como está guardado: reimportar el
 * archivo no reintroduce formatos mezclados.
 */
function memberToRow(m: ExportableMember): Record<string, unknown> {
  const doc = normalizeDocument(m.documentType, m.documentNumber);
  return {
    memberNumber: m.memberNumber,
    firstName: m.firstName,
    lastName: m.lastName,
    documentType: doc.canonicalType ?? "",
    documentNumber: doc.normalizedNumber ?? "",
    email: m.email ?? "",
    phone: m.phone ?? "",
    birthDate: toCsvDate(m.birthDate),
    address: m.address ?? "",
    city: m.city ?? "",
    province: m.province ?? "",
    postalCode: m.postalCode ?? "",
    joinedAt: toCsvDate(m.joinedAt),
    status: m.status,
    // El importador espera el NOMBRE de la categoría, no su id técnico.
    category: m.category?.name ?? "",
    notes: m.notes ?? "",
  };
}

export function buildMembersCsv(members: ExportableMember[]): string {
  const keys = MEMBER_IMPORT_COLUMNS.map((c) => c.key);
  const header = keys.join(",");
  const rows = members.map((m) => {
    const row = memberToRow(m);
    return keys.map((k) => toCsvCell(row[k])).join(",");
  });
  // CRLF: es lo que espera Excel en Windows, y el resto lo tolera sin problema.
  return [header, ...rows].join("\r\n");
}

/**
 * Nombre de archivo seguro. El nombre del workspace lo escribe un usuario, así que nunca se
 * inserta crudo en la cabecera `Content-Disposition`: se reduce a caracteres inocuos para no
 * permitir inyección de cabeceras ni recorridos de ruta.
 */
export function buildExportFilename(workspaceName: string, scope: "todos" | "filtrados", now = new Date()): string {
  const slug =
    workspaceName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  return `padron-${slug}-${scope}-${now.toISOString().slice(0, 10)}.csv`;
}

export type ExportFilters = {
  search?: string;
  status?: MemberStatus;
  categoryId?: string;
};

const VALID_STATUS = new Set(["ACTIVE", "SUSPENDED", "INACTIVE"]);

/**
 * Reconstruye los filtros DESDE LA URL, validándolos. Nunca se confía en una lista de ids
 * mandada por el navegador: el servidor rearma la consulta autorizada con el `workspaceId` de
 * la sesión, así que un usuario no puede pedir "exportá estos ids" y llevarse filas ajenas.
 * Un filtro inválido se descarta (se ignora), no ensancha el resultado.
 */
export function parseExportFilters(params: URLSearchParams): ExportFilters {
  const search = params.get("q")?.trim();
  const statusRaw = params.get("status")?.trim();
  const categoryId = params.get("categoryId")?.trim();
  return {
    search: search || undefined,
    status: statusRaw && VALID_STATUS.has(statusRaw) ? (statusRaw as MemberStatus) : undefined,
    categoryId: categoryId || undefined,
  };
}

/** `true` si la exportación viene acotada por algún filtro real. Define el nombre del archivo. */
export function hasActiveFilters(f: ExportFilters): boolean {
  return Boolean(f.search || f.status || f.categoryId);
}
