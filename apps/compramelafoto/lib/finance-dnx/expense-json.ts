import type { ExpenseEntry, ExpenseEntryAllocation, ExpenseVendor } from "@prisma/client";

type ExpenseEntryConReparto = ExpenseEntry & {
  allocations: ExpenseEntryAllocation[];
  vendor?: ExpenseVendor;
};

export type ExpenseEntryAllocationJson = Omit<
  ExpenseEntryAllocation,
  "sharePercent" | "amountArs"
> & {
  sharePercent: number;
  amountArsMinor: number;
};

export type ExpenseEntryJson = Omit<
  ExpenseEntry,
  "amountOriginal" | "fxRate" | "taxPercent" | "amountArs" | "amountRefunded"
> & {
  amountOriginalMinor: number;
  fxRate: number | null;
  taxPercent: number;
  amountArsMinor: number;
  amountRefundedMinor: number | null;
  allocations: ExpenseEntryAllocationJson[];
  vendor?: ExpenseVendor;
};

/**
 * Prisma guarda los montos como `Decimal` en unidades ENTERAS de moneda
 * (pesos, no centavos); acá se convierten a unidades menores enteras
 * (minor) para que el paquete puro (`@repo/finance-control`) y el resto de
 * la API sólo vean `number`. `NextResponse.json()` serializa `Decimal` como
 * string y le come los decimales, así que esta conversión tiene que pasar
 * ANTES de que la respuesta salga de la API.
 */
export function toExpenseEntryJson(entry: ExpenseEntryConReparto): ExpenseEntryJson {
  const { amountOriginal, fxRate, taxPercent, amountArs, amountRefunded, ...resto } = entry;

  return {
    ...resto,
    amountOriginalMinor: Math.round(amountOriginal.toNumber() * 100),
    fxRate: fxRate == null ? null : fxRate.toNumber(),
    taxPercent: taxPercent.toNumber(),
    amountArsMinor: Math.round(amountArs.toNumber() * 100),
    amountRefundedMinor: amountRefunded == null ? null : Math.round(amountRefunded.toNumber() * 100),
    allocations: entry.allocations.map((parte) => {
      const { sharePercent, amountArs: amountArsParte, ...restoParte } = parte;
      return {
        ...restoParte,
        sharePercent: sharePercent.toNumber(),
        amountArsMinor: Math.round(amountArsParte.toNumber() * 100),
      };
    }),
  };
}
