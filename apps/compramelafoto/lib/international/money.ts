import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";

/**
 * Decimales de la unidad menor guardada. ARS y CLP se guardan en unidades enteras
 * (en CLF los pesos van enteros); el resto se guarda en centavos.
 */
export function minorUnitDigits(currency: string): number {
  return currency === "ARS" || currency === "CLP" ? 0 : 2;
}

/** Del valor guardado (centavos o enteros) al monto "normal" (ej. 250 USD-centavos → 2.5). */
export function storedToMajor(stored: number, currency: string): number {
  return stored / 10 ** minorUnitDigits(currency);
}

/** Del monto "normal" al valor guardado, redondeado al entero más cercano. */
export function majorToStored(major: number, currency: string): number {
  return Math.round(major * 10 ** minorUnitDigits(currency));
}

/** Texto para mostrar el monto guardado en la moneda indicada. */
export function formatMoney(stored: number, currency: string): string {
  if (currency === "ARS") return formatPurchaseArs(stored);
  const d = minorUnitDigits(currency);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(storedToMajor(stored, currency));
}
