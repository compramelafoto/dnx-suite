/**
 * Adaptador PURO del motor de ¿Cuánto Cobro? (`@repo/cuanto-cobro-core`) a un ítem de presupuesto.
 *
 * El motor (`calculateCuantoCobro(perfil, presupuesto)`) devuelve el precio del TRABAJO entero:
 * `chosenPriceEffective` es el manual si se cargó uno y, si no, el recomendado con el
 * posicionamiento comercial (`recommendedBusinessPrice`). Ese precio es el del renglón: el
 * unitario es ese total dividido por la cantidad.
 *
 * Quien arma el presupuesto puede ajustar el precio (`precioAjustado`): el ítem queda con ese
 * precio y la instantánea guarda lo que sugirió el motor, para ver después cuánto se apartó.
 * La instantánea tiene costos y márgenes: es interna (ver `itemSinDatosInternos`).
 */
import type { CuantoCobroCalculationResult } from "@repo/cuanto-cobro-core";
import type { Descuento, InstantaneaCalculo, ItemPresupuesto } from "./constantes";

export type EntradaItemCalculado = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  /** Por omisión 1. */
  cantidad?: number;
  /** Precio del renglón entero elegido por la persona; null o ausente: el sugerido del motor. */
  precioAjustado?: number | null;
  descuento?: Descuento | null;
  seccion?: string | null;
  opcional?: boolean;
  productId?: string | null;
  /** Lo que se cargó en el panel (para reabrirlo); se guarda tal cual en la instantánea. */
  parametros?: unknown;
  /** Momento del cálculo; por omisión, ahora. */
  calculadoEn?: Date;
};

export type ResultadoItemCalculado =
  | { ok: true; item: ItemPresupuesto }
  | { ok: false; error: string; faltan: string[] };

const redondear2 = (n: number): number => Math.round(n * 100) / 100;
const finito = (n: number): number => (Number.isFinite(n) ? n : 0);

export function itemDesdeCalculo(resultado: CuantoCobroCalculationResult, entrada: EntradaItemCalculado): ResultadoItemCalculado {
  if (resultado.status !== "complete") {
    return {
      ok: false,
      error: "Al cálculo le faltan datos: completalos en el panel de ¿Cuánto Cobro?.",
      faltan: [...resultado.missingFields],
    };
  }
  const cantidad = entrada.cantidad !== undefined && Number.isFinite(entrada.cantidad) && entrada.cantidad > 0 ? entrada.cantidad : 1;
  const sugerido = redondear2(finito(resultado.chosenPriceEffective));
  const ajustado =
    entrada.precioAjustado !== null && entrada.precioAjustado !== undefined && Number.isFinite(entrada.precioAjustado) && entrada.precioAjustado >= 0
      ? redondear2(entrada.precioAjustado)
      : null;
  const precioRenglon = ajustado ?? sugerido;
  if (precioRenglon <= 0) {
    return { ok: false, error: "El cálculo no dio un precio: revisá horas y costos.", faltan: [] };
  }

  const calculo: InstantaneaCalculo = {
    motor: "cuanto-cobro-core",
    calculadoEn: (entrada.calculadoEn ?? new Date()).toISOString(),
    moneda: resultado.currency,
    precioRecomendado: redondear2(finito(resultado.recommendedBusinessPrice)),
    precioMinimo: redondear2(finito(resultado.minimumSustainablePrice)),
    precioSugerido: sugerido,
    valorHora: redondear2(finito(resultado.hourlyRate)),
    horasTotales: finito(resultado.totalJobHours),
    costoHumano: redondear2(finito(resultado.humanCost)),
    costosVariables: redondear2(finito(resultado.variableCosts)),
    margen: redondear2(finito(resultado.chosenMargin)),
    margenProporcion: resultado.chosenMarginRatio,
    estadoRentabilidad: resultado.chosenMarginStatus,
    posicionamiento: resultado.commercialPositioningLabel,
    advertencias: [...resultado.warnings],
    entrada: entrada.parametros ?? null,
  };

  return {
    ok: true,
    item: {
      id: entrada.id,
      productId: entrada.productId ?? null,
      nombre: entrada.nombre.trim(),
      descripcion: entrada.descripcion?.trim() || null,
      cantidad,
      precioUnitario: redondear2(precioRenglon / cantidad),
      descuento: entrada.descuento ?? null,
      modoPrecio: "CALCULO",
      calculo,
      seccion: entrada.seccion?.trim() || null,
      opcional: entrada.opcional === true,
    },
  };
}
