/**
 * Resultado real de una edición de Clickatón. Todo en centavos.
 *
 * Plata que entró (inscripciones pagas, menos reembolsos) − comisiones de MP
 * − gastos = resultado de caja. El sobrante contado que pasa a otra edición es
 * mercadería que no se perdió: suma acá y resta allá, así la suma de todas las
 * ediciones no cambia por moverlo.
 */

export const EXPENSE_CATEGORIES = [
  { key: "PUBLICIDAD", label: "Publicidad" },
  { key: "MERCHANDISING", label: "Remeras y merchandising" },
  { key: "LOGISTICA", label: "Logística y sede" },
  { key: "PREMIOS", label: "Premios" },
  { key: "OTRO", label: "Otro" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["key"];

export function normalizeExpenseCategory(raw: unknown): ExpenseCategory {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return (EXPENSE_CATEGORIES.find((c) => c.key === value)?.key ?? "OTRO") as ExpenseCategory;
}

export function expenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? "Otro";
}

export type ResultIncomeInput = {
  /** Suma cobrada de inscripciones pagas (incluye regalos pagos). */
  grossCollectedMinor: number;
  /** Lo devuelto sobre esas mismas inscripciones. */
  refundedMinor: number;
  paidRegistrations: number;
  freeRegistrations: number;
};

export type ResultFeeSettings = {
  mpProcessingFeeBps: number | null;
  mpWithdrawalFeeBps: number | null;
  mpFeesActualMinor: number | null;
};

export type ResultExpense = {
  amountMinor: number;
  category: string;
  paidBy: string | null;
  isEstimate: boolean;
};

export type ResultLeftover = {
  quantity: number;
  unitCostMinor: number | null;
};

export type EditionResult = {
  grossCollectedMinor: number;
  refundedMinor: number;
  netCollectedMinor: number;
  paidRegistrations: number;
  freeRegistrations: number;
  mpProcessingFeeMinor: number;
  mpWithdrawalFeeMinor: number;
  mpFeesTotalMinor: number;
  /** "actual" = monto real cargado; "percent" = calculado; "missing" = sin datos. */
  mpFeesSource: "actual" | "percent" | "missing";
  netAfterFeesMinor: number;
  expensesTotalMinor: number;
  expensesEstimatedCount: number;
  expensesByCategory: Array<{ key: string; totalMinor: number }>;
  expensesByPayer: Array<{ paidBy: string; totalMinor: number }>;
  cashResultMinor: number;
  leftoverValueMinor: number;
  leftoverUnits: number;
  leftoverWithoutCost: number;
  receivedStockValueMinor: number;
  receivedStockWithoutCost: number;
  /** Caja + sobrante que queda − mercadería recibida de otra edición. */
  economicResultMinor: number;
  warnings: string[];
};

/** Porcentaje en puntos básicos aplicado a centavos, redondeado al centavo. */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

function leftoverValue(items: ResultLeftover[]) {
  let value = 0;
  let units = 0;
  let withoutCost = 0;
  for (const item of items) {
    units += item.quantity;
    if (item.unitCostMinor == null) {
      if (item.quantity > 0) withoutCost += 1;
      continue;
    }
    value += item.quantity * item.unitCostMinor;
  }
  return { value, units, withoutCost };
}

export function computeEditionResult(input: {
  income: ResultIncomeInput;
  fees: ResultFeeSettings | null;
  expenses: ResultExpense[];
  leftovers: ResultLeftover[];
  receivedFromOtherEditions: ResultLeftover[];
}): EditionResult {
  const { income, expenses } = input;
  const fees = input.fees ?? {
    mpProcessingFeeBps: null,
    mpWithdrawalFeeBps: null,
    mpFeesActualMinor: null,
  };
  const warnings: string[] = [];

  const netCollectedMinor = income.grossCollectedMinor - income.refundedMinor;

  let mpProcessingFeeMinor = 0;
  let mpWithdrawalFeeMinor = 0;
  let mpFeesSource: EditionResult["mpFeesSource"] = "missing";
  if (fees.mpFeesActualMinor != null) {
    mpFeesSource = "actual";
  } else if (fees.mpProcessingFeeBps != null || fees.mpWithdrawalFeeBps != null) {
    mpFeesSource = "percent";
    mpProcessingFeeMinor = applyBps(netCollectedMinor, fees.mpProcessingFeeBps ?? 0);
    // El retiro inmediato se cobra sobre lo que queda después de la comisión.
    mpWithdrawalFeeMinor = applyBps(
      netCollectedMinor - mpProcessingFeeMinor,
      fees.mpWithdrawalFeeBps ?? 0,
    );
    if (fees.mpProcessingFeeBps == null) warnings.push("Falta el % que cobra Mercado Pago por el uso.");
    if (fees.mpWithdrawalFeeBps == null) warnings.push("Falta el % del retiro inmediato.");
  } else if (netCollectedMinor > 0) {
    warnings.push("Faltan las comisiones de Mercado Pago: el resultado se ve mejor de lo que es.");
  }
  const mpFeesTotalMinor =
    mpFeesSource === "actual"
      ? (fees.mpFeesActualMinor as number)
      : mpProcessingFeeMinor + mpWithdrawalFeeMinor;
  const netAfterFeesMinor = netCollectedMinor - mpFeesTotalMinor;

  const byCategory = new Map<string, number>();
  const byPayer = new Map<string, number>();
  let expensesTotalMinor = 0;
  let expensesEstimatedCount = 0;
  for (const e of expenses) {
    expensesTotalMinor += e.amountMinor;
    if (e.isEstimate) expensesEstimatedCount += 1;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountMinor);
    const payer = e.paidBy?.trim() || "Sin indicar";
    byPayer.set(payer, (byPayer.get(payer) ?? 0) + e.amountMinor);
  }
  if (expensesEstimatedCount > 0) {
    warnings.push(
      expensesEstimatedCount === 1
        ? "Hay 1 gasto aproximado: falta el número definitivo."
        : `Hay ${expensesEstimatedCount} gastos aproximados: falta el número definitivo.`,
    );
  }

  const cashResultMinor = netAfterFeesMinor - expensesTotalMinor;

  const left = leftoverValue(input.leftovers);
  const received = leftoverValue(input.receivedFromOtherEditions);
  if (left.withoutCost > 0) {
    warnings.push("Hay sobrante sin costo por unidad: no suma a su valor.");
  }
  if (received.withoutCost > 0) {
    warnings.push("Hay mercadería recibida de otra edición sin costo por unidad.");
  }

  const economicResultMinor = cashResultMinor + left.value - received.value;

  const sortDesc = <T extends { totalMinor: number }>(rows: T[]) =>
    rows.sort((a, b) => b.totalMinor - a.totalMinor);

  return {
    grossCollectedMinor: income.grossCollectedMinor,
    refundedMinor: income.refundedMinor,
    netCollectedMinor,
    paidRegistrations: income.paidRegistrations,
    freeRegistrations: income.freeRegistrations,
    mpProcessingFeeMinor,
    mpWithdrawalFeeMinor,
    mpFeesTotalMinor,
    mpFeesSource,
    netAfterFeesMinor,
    expensesTotalMinor,
    expensesEstimatedCount,
    expensesByCategory: sortDesc(
      [...byCategory].map(([key, totalMinor]) => ({ key, totalMinor })),
    ),
    expensesByPayer: sortDesc(
      [...byPayer].map(([paidBy, totalMinor]) => ({ paidBy, totalMinor })),
    ),
    cashResultMinor,
    leftoverValueMinor: left.value,
    leftoverUnits: left.units,
    leftoverWithoutCost: left.withoutCost,
    receivedStockValueMinor: received.value,
    receivedStockWithoutCost: received.withoutCost,
    economicResultMinor,
    warnings,
  };
}

/**
 * "7,61" / "7.61" / "7,61 %" → 761 puntos básicos. Vacío → null.
 * Rechaza negativos y más de 100 %.
 */
export function parsePercentToBps(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw).replace("%", "").trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Porcentaje inválido: usá hasta dos decimales.");
  const bps = Math.round(Number(text) * 100);
  if (bps > 10_000) throw new Error("El porcentaje no puede superar 100 %.");
  return bps;
}

export function formatBpsAsPercent(bps: number | null): string {
  if (bps == null) return "";
  return (bps / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/**
 * Pesos como los escribe una persona → centavos. "230.000", "$ 44.000",
 * "1500,50", "250000" → centavos. Vacío → null.
 */
export function parsePesosToMinor(raw: unknown): number | null {
  if (raw == null) return null;
  let text = String(raw).replace(/\$|\s|ARS/gi, "").trim();
  if (!text) return null;
  if (text.includes(",")) {
    // Formato argentino: punto de miles, coma decimal.
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Importe inválido.");
  const minor = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(minor) || minor > 2_000_000_000) throw new Error("Importe demasiado grande.");
  return minor;
}

export function minorToPesosInput(minor: number | null): string {
  if (minor == null) return "";
  const pesos = minor / 100;
  return Number.isInteger(pesos) ? String(pesos) : pesos.toFixed(2).replace(".", ",");
}
