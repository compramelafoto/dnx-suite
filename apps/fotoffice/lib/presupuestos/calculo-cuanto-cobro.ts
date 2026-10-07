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
import {
  calculateCuantoCobro,
  INITIAL_CUANTO_COBRO_PROFILE,
  INITIAL_CUANTO_COBRO_QUOTE,
  type CuantoCobroCalculationResult,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
} from "@repo/cuanto-cobro-core";
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

// --- Recalcular en el servidor (R2) ------------------------------------------------------------

/**
 * Lo que el panel guarda en `calculo.entrada` para poder recalcular: el perfil y el trabajo, tal
 * como los recibe el motor.
 */
export type EntradaMotor = { perfil: CuantoCobroProfileInput; presupuesto: CuantoCobroQuoteInput };

/** Tope del JSON de entrada (el perfil y el trabajo de un panel real pesan unos pocos KB). */
export const TOPE_ENTRADA_MOTOR = 200_000;

function objetoPlano(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Valida la forma de la entrada (sin confiar en nada) o devuelve null. */
export function entradaDelMotor(v: unknown): EntradaMotor | null {
  if (!objetoPlano(v) || !objetoPlano(v.perfil) || !objetoPlano(v.presupuesto)) return null;
  let largo: number;
  try {
    largo = JSON.stringify(v).length;
  } catch {
    return null;
  }
  if (largo > TOPE_ENTRADA_MOTOR) return null;
  return { perfil: v.perfil as CuantoCobroProfileInput, presupuesto: v.presupuesto as CuantoCobroQuoteInput };
}

/**
 * R2: el servidor nunca confía en la instantánea que manda el navegador. Con las ENTRADAS
 * guardadas corre el motor otra vez y arma la instantánea de nuevo; del ítem que llegó sólo toma
 * lo que la persona puede elegir (nombre, cantidad, descuento, sección, opcional y el precio, que
 * es ajustable). Si el precio que llegó es 0, queda el sugerido del motor.
 */
export function recalcularItemCalculo(
  item: ItemPresupuesto,
  entrada: EntradaMotor,
  calculadoEn: Date = new Date(),
): ResultadoItemCalculado {
  let resultado: CuantoCobroCalculationResult;
  try {
    resultado = calculateCuantoCobro(
      { ...INITIAL_CUANTO_COBRO_PROFILE, ...entrada.perfil },
      { ...INITIAL_CUANTO_COBRO_QUOTE, ...entrada.presupuesto },
    );
  } catch {
    return { ok: false, error: "Los datos del cálculo de ¿Cuánto Cobro? no son válidos.", faltan: [] };
  }
  const ajustado = item.precioUnitario > 0;
  const r = itemDesdeCalculo(resultado, {
    id: item.id,
    nombre: item.nombre,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precioAjustado: ajustado ? redondear2(item.precioUnitario * item.cantidad) : null,
    descuento: item.descuento,
    seccion: item.seccion,
    opcional: item.opcional,
    productId: item.productId,
    parametros: entrada,
    calculadoEn,
  });
  // El unitario elegido queda tal cual (sin la vuelta por el total, que puede correr un centavo).
  if (r.ok && ajustado) r.item.precioUnitario = item.precioUnitario;
  return r;
}
