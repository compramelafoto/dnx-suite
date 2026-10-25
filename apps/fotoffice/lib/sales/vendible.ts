import type { Prisma } from "@repo/db";

/**
 * Un insumo (papel, tinta, kits) se gasta pero nunca se vende: ningún lugar que ofrezca cosas
 * para cobrar o presupuestar puede listarlo. Todo `where` de "lo ofrecible" suma este filtro.
 */
export const NO_ES_INSUMO: Prisma.ProductWhereInput = { kind: { not: "INSUMO" } };

export function esVendible(kind: string): boolean {
  return kind !== "INSUMO";
}

/** Mensaje único para cualquier camino que reciba un insumo donde se esperaba algo vendible. */
export const MENSAJE_INSUMO_NO_SE_VENDE = "Eso es un insumo: no se vende.";
