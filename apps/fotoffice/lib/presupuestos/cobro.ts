/**
 * Condiciones de cobro de un presupuesto (etapa B, 15/10/2026). Módulo PURO.
 *
 * Se calculan AL ENVIAR, desde el bloque de impuestos, cobros y recargos del perfil de precios
 * (`pricingExtras`), y quedan congeladas en la versión dentro de su instantánea de opciones de pago
 * (`paymentOptions.cobro`): lo que vio el cliente no cambia aunque después cambie el perfil.
 *
 * - IVA: sólo responsable inscripto; el total del cliente es total + IVA.
 * - Seña: % del total de la opción elegida (cuota 1 del plan).
 * - Descuento por transferencia: la comisión del medio de pago, si se suma al precio (decisión del
 *   15/10: se suma a todos y a quien no usa Mercado Pago se le descuenta).
 * - Política de cancelación: va dentro de las condiciones.
 *
 * Sin nada de eso, `null`: el presupuesto se comporta exactamente como antes.
 */
import { parsePercent, type CuantoCobroPricingExtras } from "@repo/cuanto-cobro-core";

export type CondicionesCobro = {
  version: 1;
  ivaCondicion: CuantoCobroPricingExtras["ivaCondition"];
  ivaPorcentaje: number;
  totalSinIva: number;
  iva: number;
  total: number;
  senaPorcentaje: number;
  descuentoTransferenciaPorcentaje: number;
  politicaCancelacion: string | null;
};

const IVA_POR_OMISION = 21;
const aCentavos = (n: number) => Math.round(n * 100);
const aPesos = (c: number) => c / 100;

export function condicionesDeCobro(extras: CuantoCobroPricingExtras | null | undefined, totalSinIva: number): CondicionesCobro | null {
  if (!extras) return null;
  const ri = extras.ivaCondition === "responsable_inscripto";
  const ivaPorcentaje = ri ? (extras.ivaPercent.trim() === "" ? IVA_POR_OMISION : (parsePercent(extras.ivaPercent) ?? IVA_POR_OMISION)) : 0;
  const senaPorcentaje = parsePercent(extras.depositPercent) ?? 0;
  const comision = parsePercent(extras.paymentCommissionPercent) ?? 0;
  const descuentoTransferenciaPorcentaje = extras.includeCommissionInPrice && comision > 0 ? comision : 0;
  const politicaCancelacion = extras.cancellationPolicy?.trim() || null;
  if (!ri && senaPorcentaje === 0 && descuentoTransferenciaPorcentaje === 0 && !politicaCancelacion) return null;
  const base = aCentavos(Math.max(0, totalSinIva));
  const iva = Math.round((base * ivaPorcentaje) / 100);
  return {
    version: 1,
    ivaCondicion: extras.ivaCondition,
    ivaPorcentaje,
    totalSinIva: aPesos(base),
    iva: aPesos(iva),
    total: aPesos(base + iva),
    senaPorcentaje,
    descuentoTransferenciaPorcentaje,
    politicaCancelacion,
  };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Lo congelado en la versión, validado. null si no hay o no tiene forma. */
export function leerCondicionesCobro(raw: unknown): CondicionesCobro | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  if (![r.ivaPorcentaje, r.totalSinIva, r.iva, r.total, r.senaPorcentaje, r.descuentoTransferenciaPorcentaje].every(num)) return null;
  const cond = r.ivaCondicion;
  if (cond !== "" && cond !== "monotributo" && cond !== "responsable_inscripto" && cond !== "exento") return null;
  return {
    version: 1,
    ivaCondicion: cond,
    ivaPorcentaje: r.ivaPorcentaje as number,
    totalSinIva: r.totalSinIva as number,
    iva: r.iva as number,
    total: r.total as number,
    senaPorcentaje: Math.min(100, r.senaPorcentaje as number),
    descuentoTransferenciaPorcentaje: Math.min(100, r.descuentoTransferenciaPorcentaje as number),
    politicaCancelacion: typeof r.politicaCancelacion === "string" && r.politicaCancelacion.trim() ? r.politicaCancelacion.trim() : null,
  };
}
