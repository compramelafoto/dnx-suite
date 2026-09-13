/**
 * Constantes del módulo de caja.
 *
 * La clave `cash` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts`.
 */

export const CASH_MODULE_KEY = "cash";

/** Sólo las cuentas EFECTIVO se arquean: lo digital se concilia, no se cuenta. */
export const CASH_ACCOUNT_KINDS = ["EFECTIVO", "DIGITAL"] as const;
export type CashAccountKind = (typeof CASH_ACCOUNT_KINDS)[number];

export const MOVEMENT_KINDS = ["INGRESO", "EGRESO"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "MERCADO_PAGO",
  "TARJETA",
  "OTRO",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHIFT_STATUSES = ["ABIERTO", "CERRADO"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/**
 * De dónde vino el movimiento. Los que no son "manual" no se editan a mano: se anulan con
 * un contramovimiento, porque el dato de verdad vive en el módulo que lo originó.
 */
export const MOVEMENT_SOURCES = [
  "manual",
  "membership",
  "bookings",
  "sales",
  "work-orders",
] as const;
export type MovementSource = (typeof MOVEMENT_SOURCES)[number];

/**
 * Lo que se crea al encender el módulo.
 *
 * Una pantalla de categorías vacía no la llena nadie, y sin categorías el libro no sirve
 * para ningún reporte. Son un punto de partida editable, no una imposición.
 */
export const SEED_ACCOUNTS = [
  { name: "Caja diaria", kind: "EFECTIVO" as const, isVault: false, isDefault: true, order: 0 },
  { name: "Caja fuerte", kind: "EFECTIVO" as const, isVault: true, isDefault: false, order: 10 },
  { name: "Mercado Pago", kind: "DIGITAL" as const, isVault: false, isDefault: false, order: 20 },
] as const;

export const SEED_CATEGORIES = [
  { name: "Ventas", kind: "INGRESO" as const, order: 0 },
  { name: "Servicios", kind: "INGRESO" as const, order: 10 },
  { name: "Alquiler de espacios", kind: "INGRESO" as const, order: 20 },
  { name: "Cuotas", kind: "INGRESO" as const, order: 30 },
  { name: "Otros ingresos", kind: "INGRESO" as const, order: 90 },
  { name: "Proveedores", kind: "EGRESO" as const, order: 0 },
  { name: "Sueldos", kind: "EGRESO" as const, order: 10 },
  { name: "Alquiler del local", kind: "EGRESO" as const, order: 20 },
  { name: "Impuestos", kind: "EGRESO" as const, order: 30 },
  { name: "Otros egresos", kind: "EGRESO" as const, order: 90 },
] as const;
