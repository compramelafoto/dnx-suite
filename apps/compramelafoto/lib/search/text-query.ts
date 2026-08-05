/** Mínimo de caracteres para búsqueda por texto/número en álbumes y eventos. */
export const MIN_TEXT_SEARCH_LENGTH = 1;

export function normalizeSearchText(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "");
}

/**
 * Para consultas puramente numéricas (dorsal/camiseta/patente) usamos igualdad
 * exacta: buscar "5" no debe devolver "15" ni "50".
 * Para texto libre mantenemos contains.
 */
export function ocrTokenWhereForQuery(qNorm: string): {
  textNorm: string | { contains: string };
} {
  if (/^\d+$/.test(qNorm)) {
    return { textNorm: qNorm };
  }
  return { textNorm: { contains: qNorm } };
}
