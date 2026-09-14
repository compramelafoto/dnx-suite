import { allocateByBasisPoints } from "@repo/payments/edition-checkout";

/**
 * Cómo se reparte una venta entre la plataforma y quien vendió.
 *
 * El reparto no se calcula acá: lo hace `allocateByBasisPoints` de `@repo/payments`,
 * que reparte por resto mayor y **garantiza que la suma dé exactamente el monto**.
 * Escribir la cuenta a mano funcionaría hasta el primer redondeo que no cierre, y eso
 * se descubre en la rendición del mes con alguien reclamando.
 *
 * Lo único propio de Subí la Foto es cuánto: el 15%.
 */

/** 1500 puntos básicos = 15,00 %. En puntos básicos para no arrastrar decimales. */
export const COMISION_POR_DEFECTO_BPS = 1500;

export type Reparto = {
  plataformaCents: number;
  vendedorCents: number;
};

export function repartir(montoCents: number, bps = COMISION_POR_DEFECTO_BPS): Reparto {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("La comisión tiene que estar entre 0 y 10000 puntos básicos.");
  }

  const filas = allocateByBasisPoints(montoCents, [
    { id: "plataforma", basisPoints: bps, sortOrder: 0 },
    { id: "vendedor", basisPoints: 10_000 - bps, sortOrder: 1 },
  ]);

  const busca = (id: string) => filas.find((f) => f.id === id)?.allocationAmount ?? 0;
  return { plataformaCents: busca("plataforma"), vendedorCents: busca("vendedor") };
}
