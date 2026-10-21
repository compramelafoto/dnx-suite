/**
 * Receta de consumo de un producto (módulo PURO: sin base de datos).
 * "Vender `porCada` unidades gasta `quantity` del insumo."
 */

export type LineaReceta = { insumoId: string; quantity: number; porCada: number };
type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

export const ERROR_INSUMO_REPETIDO = "Ese insumo ya está en la receta.";
export const ERROR_CANTIDAD = "La cantidad tiene que ser un número entero mayor que cero.";
export const ERROR_POR_CADA = "«Cada cuántas» tiene que ser un número entero desde 1.";
export const ERROR_MISMO_PRODUCTO = "Un producto no puede gastarse a sí mismo.";

/** Consumo de un renglón: redondea para arriba (las piezas de distintos clientes no se juntan en una hoja). */
export function consumoPorRenglon(qty: number, linea: { quantity: number; porCada: number }): number {
  return Math.ceil(qty / Math.max(1, linea.porCada)) * linea.quantity;
}

export function normalizarReceta(productId: string, entrada: readonly LineaReceta[]): Resultado<LineaReceta[]> {
  const vistos = new Set<string>();
  for (const l of entrada) {
    if (l.insumoId === productId) return { ok: false, error: ERROR_MISMO_PRODUCTO };
    if (vistos.has(l.insumoId)) return { ok: false, error: ERROR_INSUMO_REPETIDO };
    vistos.add(l.insumoId);
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) return { ok: false, error: ERROR_CANTIDAD };
    if (!Number.isInteger(l.porCada) || l.porCada < 1) return { ok: false, error: ERROR_POR_CADA };
  }
  return { ok: true, valor: entrada.map((l) => ({ insumoId: l.insumoId, quantity: l.quantity, porCada: l.porCada })) };
}

/** Hojas por unidad vendida × consumo del tamaño. Sólo si se cobra por PIEZA entran varias en una hoja. */
export function sugerirLineas(d: {
  unidad: "HOJA" | "COPIA" | "PIEZA";
  piezasPorHoja: number;
  consumos: readonly { insumoId: string; quantity: number }[];
}): LineaReceta[] {
  const porCada = d.unidad === "PIEZA" ? Math.max(1, Math.floor(d.piezasPorHoja)) : 1;
  return d.consumos.map((c) => ({ insumoId: c.insumoId, quantity: c.quantity, porCada }));
}

/** Polaroid por pieza en hoja 10x15, 13x18 o 15x20: entran 2. Todo lo demás, 1. */
export function piezasPorHojaSugeridas(d: {
  tipoPieza: "COPIA" | "CARNET" | "POLAROID";
  unidad: "HOJA" | "COPIA" | "PIEZA";
  tamanoHoja: string;
}): number {
  const tamanos = ["10x15", "13x18", "15x20"];
  return d.tipoPieza === "POLAROID" && d.unidad === "PIEZA" && tamanos.includes(d.tamanoHoja.trim()) ? 2 : 1;
}
