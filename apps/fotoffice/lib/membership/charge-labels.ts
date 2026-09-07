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
  return isOpeningBalance(period) ? APERTURA_LABEL : periodoLegible(period);
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
