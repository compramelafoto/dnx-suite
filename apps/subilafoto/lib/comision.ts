/**
 * Cómo se reparte una venta entre la plataforma y quien vendió.
 *
 * Todo en centavos enteros y con una sola regla que no se negocia: **lo que va
 * a la plataforma más lo que va al vendedor tiene que dar exactamente la
 * venta**. Ni un centavo de más ni de menos. Un reparto que no cierra se
 * descubre en la rendición del mes, cuando ya hay alguien reclamando.
 */

/** 1500 puntos básicos = 15,00 %. En puntos básicos para no arrastrar decimales. */
export const COMISION_POR_DEFECTO_BPS = 1500;

export type Reparto = {
  plataformaCents: number;
  vendedorCents: number;
};

export function repartir(montoCents: number, bps: number): Reparto {
  if (!Number.isInteger(montoCents) || montoCents < 0) {
    throw new Error("El monto tiene que ser un entero de centavos y no puede ser negativo.");
  }
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("La comisión tiene que estar entre 0 y 10000 puntos básicos.");
  }

  // Al centavo más cercano y no siempre para arriba: redondear hacia arriba de
  // forma sistemática es cobrarle de más al vendedor en cada venta.
  const plataformaCents = Math.round((montoCents * bps) / 10_000);

  // El resto sale por diferencia, nunca de otra cuenta. Así el total cierra
  // siempre, sin importar cómo haya caído el redondeo.
  return { plataformaCents, vendedorCents: montoCents - plataformaCents };
}
