import { diasEntre } from "./needs-analysis";
import type { OportunidadVenta } from "./opportunity";

/**
 * La limpieza inicial: oportunidades que casi seguro ya no se venden. Por regla, sin Claude:
 * decidir que un evento de marzo ya pasó no necesita un modelo. Módulo PURO.
 */
export function esCandidataACerrar(input: {
  oportunidad: OportunidadVenta;
  staleDays: number;
  hoy: Date;
}): { cerrar: boolean; motivo: string | null } {
  const { oportunidad: op, hoy } = input;
  if (op.fechaEvento && diasEntre(op.fechaEvento, hoy) >= 1) {
    return { cerrar: true, motivo: "La fecha del evento ya pasó" };
  }
  if (diasEntre(op.modificadaEn, hoy) >= input.staleDays) {
    return { cerrar: true, motivo: `Sin movimiento hace ${input.staleDays} días` };
  }
  return { cerrar: false, motivo: null };
}
