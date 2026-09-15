import { COMISION_POR_DEFECTO_BPS, repartir } from "./comision";

/**
 * Las dos formas de vender un evento.
 *
 * **Sin descarga:** el cliente paga el precio del fotógrafo. La plataforma toma el 15% y
 * después le vende la descarga al cliente por correo, aparte.
 *
 * **Con descarga:** el fotógrafo comparte un enlace con un 10% sumado a su precio, y el
 * paquete se manda solo dentro de las 24 horas. Ese 10% es de la plataforma.
 *
 * Lo que hace que el fotógrafo pueda elegir sin pensar en la plata: **cobra lo mismo de
 * las dos maneras**. Incluir la descarga no le quita nada, sólo le ahorra al cliente una
 * segunda compra. Hay un test que lo fija.
 */

/**
 * Lo que cuesta la descarga, en puntos básicos sobre el precio del fotógrafo.
 *
 * Es un número de la plataforma y no del vendedor a propósito: el ingreso de la descarga
 * es 100% nuestro, así que el precio lo ponemos nosotros. Dejarlo configurable por
 * vendedor sería dejar que fije nuestro precio.
 */
export const RECARGO_DE_DESCARGA_BPS = 1000;

export type Venta = {
  /** El precio que puso el fotógrafo. */
  baseCents: number;
  /** Lo que se suma si la descarga va incluida. Cero si no. */
  recargoCents: number;
  /** Lo que paga el cliente. */
  totalCents: number;
  /** Comisión más recargo. Va como `marketplace_fee`. */
  plataformaCents: number;
  /** Lo que le queda al fotógrafo. El mismo número en las dos formas de vender. */
  vendedorCents: number;
};

export function calcularVenta(entrada: {
  baseCents: number;
  conDescarga: boolean;
  /** Sólo para eventos con una comisión distinta a la general. */
  comisionBps?: number;
}): Venta {
  const { baseCents, conDescarga } = entrada;
  if (!Number.isInteger(baseCents) || baseCents <= 0) {
    throw new Error("El precio tiene que ser un entero de centavos mayor que cero.");
  }

  const comisionBps = entrada.comisionBps ?? COMISION_POR_DEFECTO_BPS;

  // El recargo se calcula sobre el precio del fotógrafo y no sobre el total: sobre el
  // total sería un porcentaje de algo que ya lo incluye, y el número no se puede explicar.
  const recargoCents = conDescarga
    ? repartir(baseCents, RECARGO_DE_DESCARGA_BPS).plataformaCents
    : 0;

  const { plataformaCents: comisionCents, vendedorCents } = repartir(baseCents, comisionBps);

  return {
    baseCents,
    recargoCents,
    totalCents: baseCents + recargoCents,
    plataformaCents: comisionCents + recargoCents,
    vendedorCents,
  };
}

/**
 * Lo que cuesta la descarga, sola.
 *
 * El mismo número que el recargo cuando va incluida: es el mismo producto. Cobrar distinto
 * según cuándo se compra sería difícil de explicar y fácil de discutir.
 */
export function precioDeLaDescarga(baseCents: number): number {
  if (!Number.isInteger(baseCents) || baseCents <= 0) return 0;
  return repartir(baseCents, RECARGO_DE_DESCARGA_BPS).plataformaCents;
}
