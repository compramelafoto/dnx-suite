/**
 * Las reglas de la existencia. Módulo PURO: nada acá toca la base.
 *
 * Tres reglas le dan sentido a este archivo entero:
 *
 * 1. La existencia es la suma del libro (`StockMovement`) y puede dar negativa. Un negativo
 *    significa que falta cargar una entrada; mostrarlo como cero escondería justo el dato
 *    que hay que corregir. Mismo criterio que el esperado de un turno de Caja
 *    (`lib/cash/shift.ts`), que tampoco se recorta.
 * 2. El ajuste exige nota, igual que una diferencia de arqueo (`canCloseShift`): un ajuste
 *    sin explicación no se entiende tres meses después.
 * 3. La entrada sólo suma. Para restar está el ajuste, que deja la nota. Si la entrada
 *    pudiera restar, habría dos formas de bajar una existencia y una de ellas sin
 *    explicación.
 */

/** La existencia de un producto: la suma firmada de su libro de movimientos. */
export function stockQtyFrom(movements: readonly { qty: number }[]): number {
  return movements.reduce((acc, m) => acc + m.qty, 0);
}

/**
 * Si hay que reponer. Un negativo siempre avisa, tenga o no mínimo declarado: es la misma
 * información que falta cargar una entrada. Con mínimo declarado, avisa también por debajo
 * de él —"por debajo", no "en él": justo en el mínimo todavía alcanza—. Un producto que no
 * controla stock nunca avisa: no hay libro que mirar.
 */
export function needsRestock(p: {
  tracksStock: boolean;
  stockQty: number;
  minStockQty: number | null;
}): boolean {
  if (!p.tracksStock) return false;
  if (p.stockQty < 0) return true;
  if (p.minStockQty === null) return false;
  return p.stockQty < p.minStockQty;
}

/** Lo contado menos lo que el libro dice que hay: el movimiento que hace falta escribir. */
export function adjustmentQty(input: { currentQty: number; countedQty: number }): number {
  return input.countedQty - input.currentQty;
}

export type StockCheck = { ok: true } | { ok: false; error: string };

/**
 * Una entrada de mercadería. Sólo suma —`qty` tiene que ser mayor que cero—: para restar
 * está el ajuste, que deja la nota. El costo es opcional (no siempre se sabe cuánto costó
 * esa vez), pero si viene, no puede ser negativo.
 */
export function validateStockEntry(input: {
  qty: number;
  unitCostMinor: number | null;
}): StockCheck {
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    return { ok: false, error: "La cantidad que entró tiene que ser mayor que cero." };
  }
  if (input.unitCostMinor !== null && input.unitCostMinor < 0) {
    return { ok: false, error: "El costo no puede ser negativo." };
  }
  return { ok: true };
}

/**
 * Un ajuste por conteo. No se pueden contar menos de cero cosas, y la nota es obligatoria
 * de hecho: sin ella, nadie sabe tres meses después si faltó mercadería o si alguien se
 * equivocó al contar.
 */
export function validateAdjustment(input: {
  countedQty: number;
  note: string | null;
}): StockCheck {
  if (!Number.isInteger(input.countedQty) || input.countedQty < 0) {
    return { ok: false, error: "No podés contar una cantidad negativa." };
  }
  if ((input.note ?? "").trim() === "") {
    return { ok: false, error: "Explicá por qué ajustás la existencia." };
  }
  return { ok: true };
}
