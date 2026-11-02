/** Eventos con inscriptos: congresos, jornadas, workshops (02/11/2026, Rafaela en Foco). */
export const EVENTOS_MODULE_KEY = "eventos";

export const ORIGENES = ["TIENDA", "FORMULARIO", "MANUAL"] as const;
export type Origen = (typeof ORIGENES)[number];

/** ANULADO = el pedido de la tienda se canceló después de pagarse. */
export const ESTADOS_PAGO = ["PAGADO", "PENDIENTE", "CORTESIA", "ANULADO"] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ORIGEN_LABEL: Record<Origen, string> = {
  TIENDA: "Tienda",
  FORMULARIO: "Formulario",
  MANUAL: "Carga manual",
};

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  PAGADO: "Pagado",
  PENDIENTE: "Pago pendiente",
  CORTESIA: "Cortesía",
  ANULADO: "Anulado",
};

/** Los estados de un pedido de la tienda en los que la entrada está pagada. */
export const PEDIDO_PAGADO = ["PAID", "PAID_NO_STOCK", "READY", "SHIPPED", "DELIVERED"] as const;
export const PEDIDO_ANULADO = ["CANCELLED"] as const;

export function esEstadoPago(v: unknown): v is EstadoPago {
  return typeof v === "string" && (ESTADOS_PAGO as readonly string[]).includes(v);
}
