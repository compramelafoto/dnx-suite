/**
 * Adaptador PURO del motor de ¿Cuánto Cobro? (`@repo/cuanto-cobro-core`) a un ítem de presupuesto.
 *
 * El motor (`calculateCuantoCobro(perfil, presupuesto)`) devuelve el precio del TRABAJO entero:
 * `chosenPriceEffective` es el manual si se cargó uno y, si no, el recomendado con el
 * posicionamiento comercial (`recommendedBusinessPrice`). Ese precio es el del renglón entero:
 * el ítem queda con cantidad 1 y ese precio, para que el renglón sea EXACTAMENTE el precio
 * elegido (dividirlo por una cantidad no exacta corría centavos). Las unidades que cubre el
 * trabajo quedan en la instantánea (`unidades`), sólo para mostrar.
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
import { TOPE_ENTRADA_MOTOR, type Descuento, type InstantaneaCalculo, type ItemPresupuesto } from "./constantes";

export { TOPE_ENTRADA_MOTOR };

export type EntradaItemCalculado = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  /** Unidades que cubre el trabajo (por omisión 1). Informativo: el ítem queda con cantidad 1. */
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

  // Margen del precio elegido con la cuenta del motor: chosenMargin = chosenPrice − minimumPrice.
  const costoBase = redondear2(finito(resultado.minimumPrice));
  const margenElegido = redondear2(precioRenglon - costoBase);
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
    costoBase,
    precioElegido: precioRenglon,
    unidades: cantidad,
    margenElegido,
    margenElegidoProporcion: costoBase > 0 ? Math.round((margenElegido / costoBase) * 10_000) / 10_000 : null,
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
      cantidad: 1,
      precioUnitario: precioRenglon,
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
 * lo que la persona puede elegir (nombre, cantidad, descuento, sección, opcional y el precio).
 *
 * Contrato del precio (revisión de la Task 3):
 * - `opciones.precioAjustado === true`: el precio del renglón que llegó es el elegido a mano y
 *   manda sobre el sugerido (el editor lo manda así cuando la persona toca el precio);
 * - `opciones.precioAjustado === false`: manda el motor (el precio que llegó se ignora);
 * - sin indicación (quien no ve costos recibe el ítem sin el cálculo y no puede mandar la
 *   marca): el precio cuenta como ajustado sólo si es > 0 y DISTINTO del sugerido que había
 *   quedado guardado (`sugeridoAnterior`). Si es igual, se sigue al motor: cuando cambian las
 *   entradas, el precio sigue al cálculo nuevo en vez de quedar pegado al viejo. Sin sugerido
 *   anterior (ítem nuevo), un precio > 0 cuenta como ajustado.
 *
 * Las unidades informativas salen de la instantánea del ítem que llegó o, si llegó sin ella, de
 * las guardadas (`opciones.unidades`).
 */
function unidadesPrevias(item: ItemPresupuesto, guardadas?: number | null): number {
  const u = (item.calculo as { unidades?: unknown } | null)?.unidades ?? guardadas;
  return typeof u === "number" && Number.isFinite(u) && u > 0 && u <= 100_000 ? u : 1;
}

export type OpcionesRecalculo = {
  /** Marca explícita del editor: true = precio elegido a mano; false = el del motor. */
  precioAjustado?: boolean;
  /** El precio sugerido que había quedado guardado para este renglón (para comparar). */
  sugeridoAnterior?: number | null;
  /** Unidades informativas guardadas (si el ítem llegó sin instantánea). */
  unidades?: number | null;
};

/** ¿El precio del renglón que llegó es un ajuste a mano? Ver el contrato arriba. */
export function esPrecioAjustado(precioRenglon: number, opciones: OpcionesRecalculo = {}): boolean {
  if (opciones.precioAjustado !== undefined) return opciones.precioAjustado && precioRenglon > 0;
  if (!(precioRenglon > 0)) return false;
  const ref = opciones.sugeridoAnterior;
  if (typeof ref !== "number" || !Number.isFinite(ref)) return true;
  return Math.abs(redondear2(precioRenglon) - redondear2(ref)) >= 0.005;
}

export function recalcularItemCalculo(
  item: ItemPresupuesto,
  entrada: EntradaMotor,
  calculadoEn: Date = new Date(),
  opciones: OpcionesRecalculo = {},
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
  const precioRenglon = redondear2(item.precioUnitario * item.cantidad);
  const r = itemDesdeCalculo(resultado, {
    id: item.id,
    nombre: item.nombre,
    descripcion: item.descripcion,
    // El ítem guardado tiene cantidad 1: las unidades informativas vienen de la instantánea anterior.
    cantidad: item.cantidad > 1 ? item.cantidad : unidadesPrevias(item, opciones.unidades),
    precioAjustado: esPrecioAjustado(precioRenglon, opciones) ? precioRenglon : null,
    descuento: item.descuento,
    seccion: item.seccion,
    opcional: item.opcional,
    productId: item.productId,
    parametros: entrada,
    calculadoEn,
  });
  return r;
}
