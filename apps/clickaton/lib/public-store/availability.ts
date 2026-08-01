/**
 * Presentación de disponibilidad TIENDA (solo UI).
 * No escribe stock, holds ni movimientos.
 *
 * Umbral "últimas unidades": constante de presentación documentada.
 * No hay regla de dominio canónica previa en Clickatón para merch de tienda.
 */

/** 1..LOW_STOCK_THRESHOLD inclusive → "Últimas unidades". */
export const STORE_LOW_STOCK_THRESHOLD = 5;

export type StoreAvailabilityKind = "available" | "low_stock" | "sold_out";

export type StoreAvailabilityView = {
  kind: StoreAvailabilityKind;
  label: string;
  /** Stock público derivado (stock - reserved), floor 0. */
  availableStock: number;
};

export function publicAvailableStock(stock: number, reservedStock: number): number {
  const s = Number.isFinite(stock) ? stock : 0;
  const r = Number.isFinite(reservedStock) ? reservedStock : 0;
  return Math.max(0, s - Math.max(0, r));
}

export function availabilityFromStock(availableStock: number): StoreAvailabilityView {
  const n = Math.max(0, Math.floor(availableStock));
  if (n <= 0) {
    return { kind: "sold_out", label: "Agotado", availableStock: 0 };
  }
  if (n <= STORE_LOW_STOCK_THRESHOLD) {
    return { kind: "low_stock", label: "Últimas unidades", availableStock: n };
  }
  return { kind: "available", label: "Disponible", availableStock: n };
}

/**
 * Estado global del producto a partir del stock público de sus variantes activas
 * y del storeStatus comercial.
 */
export function productAvailabilityFromVariants(input: {
  storeStatus: string;
  variantAvailableStocks: readonly number[];
}): StoreAvailabilityView {
  if (input.storeStatus === "OUT_OF_STOCK") {
    return { kind: "sold_out", label: "Agotado", availableStock: 0 };
  }
  const stocks = input.variantAvailableStocks.map((n) => Math.max(0, Math.floor(n)));
  if (stocks.length === 0) {
    // Producto simple sin variantes: no forzar agotado; stock desconocido → disponible genérico.
    return { kind: "available", label: "Disponible", availableStock: 0 };
  }
  const max = Math.max(...stocks);
  return availabilityFromStock(max);
}
