/**
 * Constantes del módulo de ventas.
 *
 * Todo texto y ningún enum de Prisma: el esquema lo comparten las cinco aplicaciones de la
 * suite, y un enum que falte en alguna base rompe las escrituras de esa aplicación.
 */

export const SALES_MODULE_KEY = "sales";

/** Qué es la cosa. No cambia ninguna regla: agrupa en pantalla y separa la línea del reporte. */
export const PRODUCT_KINDS = ["PRODUCTO", "SERVICIO"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

/** Por qué se movió la existencia. */
export const STOCK_REASONS = ["VENTA", "ENTRADA", "AJUSTE", "DEVOLUCION", "INICIAL"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const SALE_STATUSES = ["COMPLETADA", "ANULADA"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/**
 * Cómo pagó el cliente. La pantalla no cobra: registra.
 *
 * Los mismos valores que `PAYMENT_METHODS` de Caja, a propósito: es lo que le permite a
 * `resolveDepositTarget` elegir la cuenta correcta sin traducir nada.
 */
export const SALE_PAYMENT_METHODS = [
  "EFECTIVO",
  "MERCADO_PAGO",
  "TRANSFERENCIA",
  "TARJETA",
  "OTRO",
] as const;
export type SalePaymentMethod = (typeof SALE_PAYMENT_METHODS)[number];

/** La categoría de Caja donde caen los ingresos de una venta. */
export const SALES_CASH_CATEGORY_NAME = "Ventas";
