/**
 * Pedidos y cobros (etapa 3, Entrega A). Módulo PURO: valores guardados y sus etiquetas.
 *
 * Los valores van en mayúsculas, como en los CHECK del SQL
 * (`20261022120000_fotoffice_etapa_3_pedidos`). Los medios de cobro son los mismos 5 de Caja
 * (`CashMovement.paymentMethod`), para que cada cobro caiga en la cuenta que corresponde.
 */

import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/constants";

// --- Estados del pedido -----------------------------------------------------------------------

export const ESTADOS_PEDIDO = ["CONFIRMADO", "EN_CURSO", "COMPLETADO", "CANCELADO"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  CONFIRMADO: "Confirmado",
  EN_CURSO: "En curso",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

export function esEstadoPedido(v: unknown): v is EstadoPedido {
  return typeof v === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(v);
}

// --- Estado de cada cuota (se calcula al leer; no se guarda) ----------------------------------

export const ESTADOS_CUOTA = ["PAGADA", "PARCIAL", "VENCIDA", "PENDIENTE", "CANCELADA"] as const;
export type EstadoCuota = (typeof ESTADOS_CUOTA)[number];

export const ETIQUETA_ESTADO_CUOTA: Record<EstadoCuota, string> = {
  PAGADA: "Pagada",
  PARCIAL: "Parcial",
  VENCIDA: "Vencida",
  PENDIENTE: "Pendiente",
  CANCELADA: "Cancelada",
};

// --- Medios de cobro --------------------------------------------------------------------------

/** Los mismos de Caja (`lib/cash/constants.ts`). */
export const MEDIOS_COBRO = PAYMENT_METHODS;
export type MedioCobro = PaymentMethod;

export const ETIQUETA_MEDIO_COBRO: Record<MedioCobro, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

export function esMedioCobro(v: unknown): v is MedioCobro {
  return typeof v === "string" && (MEDIOS_COBRO as readonly string[]).includes(v);
}

// --- Opciones de pago -------------------------------------------------------------------------

/** Id estable de la opción de contado. Los planes de cuotas usan el `id` del plan. */
export const ID_OPCION_CONTADO = "contado";
/** Id de la opción por omisión ("Hasta N cuotas sin interés") cuando la organización no configuró ninguna. */
export const ID_OPCION_OMISION = "omision";
/** Tope de cuotas de la opción por omisión. */
export const MAX_CUOTAS_OMISION = 6;

// --- Varios -----------------------------------------------------------------------------------

/** Secuencias de numeración (`FotofficeRecordNumber.entityType`). */
export const ENTIDAD_NUMERACION_PEDIDO = "PEDIDO";
export const ENTIDAD_NUMERACION_RECIBO = "RECIBO";
/** `CashMovement.sourceModule` de los cobros de pedidos. */
export const MODULO_CAJA_PEDIDOS = "pedidos";
/** Leyenda fija del recibo X interno. */
export const LEYENDA_RECIBO = "Documento no válido como factura";
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
