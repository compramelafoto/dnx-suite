/**
 * La escalera de referidos de Clickatón.
 *
 * El titular que se comunica es "traé 5 colegas y tu próxima Clickatón es
 * gratis". Los escalones intermedios existen porque con una base chica casi
 * nadie llega a 5, y un premio inalcanzable no se comparte: el que trae uno
 * solo ya ganó algo y vuelve a intentar.
 *
 * Vive en código y no en base: es una decisión comercial que se toca por
 * commit y todavía no merece un CRUD.
 */

export type EscalonReferidos = {
  /** Colegas traídos (pago aprobado) necesarios para alcanzar este escalón. */
  colegas: number;
  /** Porcentaje de descuento sobre la próxima inscripción. */
  descuento: number;
};

export const ESCALERA_REFERIDOS: readonly EscalonReferidos[] = [
  { colegas: 1, descuento: 10 },
  { colegas: 2, descuento: 20 },
  { colegas: 3, descuento: 35 },
  { colegas: 4, descuento: 60 },
  { colegas: 5, descuento: 100 },
] as const;

/** Colegas necesarios para el premio máximo (el número del titular). */
export const COLEGAS_PARA_GRATIS =
  ESCALERA_REFERIDOS[ESCALERA_REFERIDOS.length - 1]!.colegas;

/** Normaliza un contador que puede venir de la base o de un cálculo. */
function colegasValidos(colegas: number): number {
  if (!Number.isFinite(colegas) || colegas < 0) return 0;
  return Math.floor(colegas);
}

/**
 * Porcentaje de descuento que le corresponde a quien trajo `colegas`.
 * Nunca supera el 100%: nadie cobra por inscribirse.
 */
export function descuentoPorColegas(colegas: number): number {
  const n = colegasValidos(colegas);
  let descuento = 0;
  for (const escalon of ESCALERA_REFERIDOS) {
    if (n >= escalon.colegas) descuento = escalon.descuento;
  }
  return descuento;
}

/** El próximo escalón a alcanzar, o null si ya llegó al tope. */
export function siguienteEscalon(colegas: number): EscalonReferidos | null {
  const n = colegasValidos(colegas);
  return ESCALERA_REFERIDOS.find((escalon) => escalon.colegas > n) ?? null;
}

/** Cuántos colegas faltan para el próximo escalón. 0 si ya está en el tope. */
export function colegasParaElSiguienteEscalon(colegas: number): number {
  const siguiente = siguienteEscalon(colegas);
  if (!siguiente) return 0;
  return siguiente.colegas - colegasValidos(colegas);
}

/**
 * Cuántas atribuciones se consumen al canjear con `colegas` disponibles.
 * Sólo se queman las que el escalón alcanzado justifica: si alguien trajo 7,
 * usa 5 y se queda con 2 para la próxima.
 */
export function colegasQueConsumeElCanje(colegas: number): number {
  const n = colegasValidos(colegas);
  let consumidos = 0;
  for (const escalon of ESCALERA_REFERIDOS) {
    if (n >= escalon.colegas) consumidos = escalon.colegas;
  }
  return consumidos;
}
