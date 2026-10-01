import type { AllocatedAmount } from "./allocation";

/**
 * Estados de un gasto.
 *
 * Facturado NO es lo mismo que pagado: hay facturas emitidas que la tarjeta
 * rechazó y cobros que después se reembolsaron. Contar lo facturado como gasto
 * infla el número; contar sólo lo pagado esconde la deuda.
 */
export type ExpenseStatus =
  | "ESTIMADO"
  | "FACTURADO"
  | "PAGADO"
  | "RECHAZADO"
  | "IMPAGO"
  | "REEMBOLSADO";

export type SummaryEntry = {
  vendorKey: string;
  amountArsMinor: number;
  /**
   * Monto reembolsado (total o parcial). "Pagado" tiene que ser neto de
   * reembolsos: lo que efectivamente quedó afuera de la cuenta. Es opcional
   * porque la mayoría de las entradas no tiene reembolso. `amountArsMinor`
   * (lo facturado) no se toca: un reembolso no desfactura la compra.
   */
  amountRefundedMinor?: number;
  status: ExpenseStatus;
  allocations: AllocatedAmount[];
};

export type PlatformTotal = {
  platformKey: string;
  /** Gasto que es enteramente de esta plataforma (reparto del 100%). */
  directArsMinor: number;
  /** Parte que le toca de gastos compartidos. */
  proratedArsMinor: number;
  totalArsMinor: number;
};

export type MonthlySummary = {
  billedArsMinor: number;
  paidArsMinor: number;
  debtArsMinor: number;
  byPlatform: PlatformTotal[];
};

const ESTADOS_DE_DEUDA: ReadonlySet<ExpenseStatus> = new Set(["RECHAZADO", "IMPAGO"]);

export function buildMonthlySummary(entries: SummaryEntry[]): MonthlySummary {
  let billedArsMinor = 0;
  let paidArsMinor = 0;
  let debtArsMinor = 0;

  const porPlataforma = new Map<string, PlatformTotal>();

  for (const entry of entries) {
    billedArsMinor += entry.amountArsMinor;
    if (entry.status === "PAGADO") {
      paidArsMinor += entry.amountArsMinor - (entry.amountRefundedMinor ?? 0);
    }
    if (ESTADOS_DE_DEUDA.has(entry.status)) debtArsMinor += entry.amountArsMinor;

    for (const parte of entry.allocations) {
      const actual = porPlataforma.get(parte.platformKey) ?? {
        platformKey: parte.platformKey,
        directArsMinor: 0,
        proratedArsMinor: 0,
        totalArsMinor: 0,
      };
      if (parte.sharePercent >= 100) actual.directArsMinor += parte.amountArsMinor;
      else actual.proratedArsMinor += parte.amountArsMinor;
      actual.totalArsMinor += parte.amountArsMinor;
      porPlataforma.set(parte.platformKey, actual);
    }
  }

  const byPlatform = [...porPlataforma.values()].sort(
    (a, b) => b.totalArsMinor - a.totalArsMinor,
  );

  return { billedArsMinor, paidArsMinor, debtArsMinor, byPlatform };
}
