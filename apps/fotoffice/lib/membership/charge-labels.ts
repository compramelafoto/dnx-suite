/**
 * Cómo se le nombra al socio cada cargo de su cuenta.
 *
 * Módulo PURO: sin base y sin red, así se puede verificar el vocabulario sin montar nada.
 * Lo importan pantallas de servidor y el armado de emails, y por eso vive acá y no dentro
 * de una página.
 *
 * Existe por un error concreto: el saldo traído del sistema anterior se guarda con el
 * período literal `APERTURA` y el concepto `OTRO`, y la pantalla lo mostraba como
 * «APERTURA · Cuota mensual». Al socio le aparecía un arrastre de hasta $60.000 rotulado
 * como si fuera la cuota del mes.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Período reservado para el saldo migrado del sistema anterior. */
export const APERTURA_PERIOD = "APERTURA";

export const APERTURA_LABEL = "Deuda anterior al sistema";

/**
 * Período reservado para la credencial impresa que se pide al asociarse.
 *
 * No es un mes: es una etiqueta. La clave única del cargo es (socio, concepto, período), así
 * que un nombre en vez de una fecha garantiza uno solo por socio y se lee sin adivinar.
 */
export const PRINTED_CARD_PERIOD = "TARJETA";

export const PRINTED_CARD_LABEL = "Carnet impreso";

/**
 * Período del cargo de una reimpresión: `TARJETA-2026-09`.
 *
 * Lleva el mes porque un socio puede necesitar otra credencial —se mudó, la perdió, se le
 * venció— y el período fijo `TARJETA` sólo admite una por socio para toda la vida.
 */
export function printedCardPeriod(now: Date): string {
  const mes = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${PRINTED_CARD_PERIOD}-${now.getUTCFullYear()}-${mes}`;
}

/** ¿Este cargo es la credencial impresa, sea del alta o de una reimpresión? */
export function isPrintedCardCharge(period: string): boolean {
  return period === PRINTED_CARD_PERIOD || period.startsWith(`${PRINTED_CARD_PERIOD}-`);
}

/**
 * `2026-09` → `septiembre de 2026`.
 *
 * Sin `Intl`: el resultado no puede depender de la configuración regional del servidor.
 * Lo que no tenga forma de período mensual vuelve tal cual — traducirlo a la fuerza es lo
 * que produciría un mes inventado.
 */
export function periodoLegible(period: string): string {
  const [anio, mes] = period.split("-");
  const indice = Number(mes) - 1;
  if (!anio || !mes || Number.isNaN(indice) || indice < 0 || indice > 11) return period;
  return `${MESES[indice]} de ${anio}`;
}

export function isOpeningBalance(period: string): boolean {
  return period === APERTURA_PERIOD;
}

/** Encabezado del cargo. Nunca devuelve `APERTURA`: eso no significa nada para el socio. */
export function chargePeriodLabel(period: string): string {
  if (isOpeningBalance(period)) return APERTURA_LABEL;
  // El carnet no cubre un mes: es un objeto que se pide una vez. Mostrar «septiembre de
  // 2026» lo haría pasar por la cuota de ese mes, que es la confusión que se quiere evitar.
  if (isPrintedCardCharge(period)) return PRINTED_CARD_LABEL;
  return periodoLegible(period);
}

/**
 * Detalle del cargo.
 *
 * El período manda sobre el concepto: un cargo de apertura se explica como arrastre aunque
 * su concepto sea `OTRO`. Y un concepto desconocido NO cae en «Cuota mensual» — ese
 * respaldo optimista es justamente el que hizo pasar un arrastre por cuota del mes.
 */
export function chargeConceptLabel(concept: string, period: string): string {
  if (isOpeningBalance(period)) return "Saldo traído del sistema anterior";
  if (isPrintedCardCharge(period)) return "Impresión de carnet";
  switch (concept) {
    case "INGRESO":
      return "Cuota de ingreso";
    case "MENSUAL":
      return "Cuota mensual";
    default:
      return "Otro concepto";
  }
}

/**
 * `2026-09-10` → `10 de septiembre`.
 *
 * Se lee en UTC, que es como se guardan los vencimientos: usar la zona del servidor haría
 * que el mismo cargo dijera «9 de septiembre» o «10» según dónde corra el proceso.
 */
export function fechaLegible(date: Date): string {
  const dia = date.getUTCDate();
  const mes = MESES[date.getUTCMonth()];
  return `${dia} de ${mes}`;
}
