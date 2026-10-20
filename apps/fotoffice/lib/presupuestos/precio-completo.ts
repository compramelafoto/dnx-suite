/**
 * Precio completo de un trabajo armado con varios ítems calculados (etapa A, 15/10/2026). PURO.
 *
 * Cada ítem CALCULO guarda su desglose (`calculo.desglose`); acá se suman y se calcula a nivel
 * trabajo lo que no se reparte: la seña, el saldo y el aviso de precio mínimo. Lo usan el panel del
 * presupuesto y DNX Bot (que no hace cuentas: sólo formatea esto).
 */
import { summarizeJobPricing, type CuantoCobroJobPricingSummary, type CuantoCobroPriceBuildUp, type CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { extrasDelPerfil } from "@/lib/precios/perfil-datos";
import type { ItemPresupuesto } from "./constantes";

export type ResumenPrecioCompleto = { lineas: CuantoCobroPriceBuildUp[]; trabajo: CuantoCobroJobPricingSummary };

export function resumenDelPrecioCompleto(items: readonly Pick<ItemPresupuesto, "calculo">[], perfil: CuantoCobroProfileInput): ResumenPrecioCompleto | null {
  const lineas = items.map((i) => i.calculo?.desglose).filter((d): d is CuantoCobroPriceBuildUp => !!d);
  const trabajo = summarizeJobPricing(lineas, extrasDelPerfil(perfil));
  return trabajo ? { lineas, trabajo } : null;
}
