import { RATING_WINDOW_DAYS } from "./calificaciones";
import type { SaleSummary } from "./ventas";

/**
 * Decisiones de pantalla sobre una venta, sin base de datos: qué parte de la calificación se
 * muestra y cómo se nombra cada estado según quién mira.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type EstadoCalificacion = "FORMULARIO" | "YA_CALIFICASTE" | "VENCIDO" | "NO_CORRESPONDE";

/** Último momento para calificar: `RATING_WINDOW_DAYS` días después de la confirmación. */
export function plazoParaCalificar(resolvedAt: Date): Date {
  return new Date(resolvedAt.getTime() + RATING_WINDOW_DAYS * DIA_MS);
}

/**
 * El formulario sale sólo con la venta confirmada, dentro del plazo y sin calificación previa.
 * Una venta no confirmada (pendiente, rechazada o vencida) no se califica.
 */
export function estadoCalificacion(
  venta: { status: SaleSummary["status"]; resolvedAt: Date | null },
  yaCalifico: boolean,
  ahora: Date = new Date(),
): EstadoCalificacion {
  if (venta.status !== "CONFIRMED" || !venta.resolvedAt) return "NO_CORRESPONDE";
  if (yaCalifico) return "YA_CALIFICASTE";
  if (ahora.getTime() > plazoParaCalificar(venta.resolvedAt).getTime()) return "VENCIDO";
  return "FORMULARIO";
}

export type Rol = "COMPRADOR" | "VENDEDOR";

const ESTADOS: Record<SaleSummary["status"], Record<Rol, string> & { clase: string }> = {
  PENDING_BUYER: {
    COMPRADOR: "Falta que confirmes",
    VENDEDOR: "Esperando al comprador",
    clase: "estado estado-revision",
  },
  CONFIRMED: { COMPRADOR: "Compra confirmada", VENDEDOR: "Venta confirmada", clase: "estado estado-publicada" },
  DECLINED: { COMPRADOR: "No la compraste", VENDEDOR: "No se concretó", clase: "estado" },
  EXPIRED: { COMPRADOR: "Venció sin confirmar", VENDEDOR: "Venció sin confirmar", clase: "estado" },
};

/** Texto y clase de la píldora de estado de una venta, según quién la mira. */
export function estadoVenta(status: SaleSummary["status"], rol: Rol): { texto: string; clase: string } {
  const e = ESTADOS[status];
  return { texto: e[rol], clase: e.clase };
}
