/**
 * Códigos de barras. Módulo PURO.
 *
 * Existe para que el lector y la persona escriban lo mismo. Un lector manda los dígitos
 * pelados; una persona que copia de la caja mete espacios y a veces un guión. Los dos tienen
 * que llegar al mismo código, o el catálogo maestro se llena de duplicados del mismo
 * producto y deja de servir para lo único que sirve.
 */

/** Sólo dígitos. Devuelve null si no queda un código numérico. */
export function normalizeBarcode(raw: string): string | null {
  const limpio = raw.replace(/[\s-]/g, "");
  if (limpio === "") return null;
  if (!/^\d+$/.test(limpio)) return null;
  return limpio;
}

/**
 * Si esto parece un código de barras de verdad y no otra cosa.
 *
 * Los largos son los de los estándares reales: EAN-8, UPC-A, EAN-13 y el ITF-14 de las
 * cajas. El piso importa más de lo que parece: sin él, tipear "25" en el buscador del
 * mostrador se interpretaría como un código y no como lo que es.
 */
const LARGOS_VALIDOS = new Set([8, 12, 13, 14]);

export function looksLikeBarcode(raw: string): boolean {
  const codigo = normalizeBarcode(raw);
  return codigo !== null && LARGOS_VALIDOS.has(codigo.length);
}
