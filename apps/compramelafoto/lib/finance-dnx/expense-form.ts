import { computeAmountArsMinor, type ExpenseStatus } from "@repo/finance-control";

export type ExpenseForm = {
  vendorId: number;
  periodYear: number;
  periodMonth: number;
  amountOriginalMinor: number;
  currency: "USD" | "ARS";
  fxRate: number | null;
  taxPercent: number;
  amountArsMinor: number;
  status: ExpenseStatus;
  notes: string | null;
};

export type ExpenseFormResult =
  | { ok: true; value: ExpenseForm }
  | { ok: false; error: string };

const ESTADOS = new Set<ExpenseStatus>([
  "ESTIMADO",
  "FACTURADO",
  "PAGADO",
  "RECHAZADO",
  "IMPAGO",
  "REEMBOLSADO",
]);

export function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function parseExpenseForm(raw: unknown): ExpenseFormResult {
  const datos = raw as Record<string, unknown> | null;
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: "No llegaron datos del gasto." };
  }

  const vendorId = Number(datos.vendorId);
  if (!Number.isInteger(vendorId)) {
    return { ok: false, error: "Falta el proveedor." };
  }

  const periodYear = Number(datos.periodYear);
  if (!Number.isInteger(periodYear) || periodYear < 2020 || periodYear > 2100) {
    return { ok: false, error: "El año no es válido." };
  }

  const periodMonth = Number(datos.periodMonth);
  if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    return { ok: false, error: "El mes tiene que estar entre 1 y 12." };
  }

  const currency = String(datos.currency);
  if (currency !== "USD" && currency !== "ARS") {
    return { ok: false, error: "La moneda tiene que ser USD o ARS." };
  }

  const status = String(datos.status) as ExpenseStatus;
  if (!ESTADOS.has(status)) {
    return { ok: false, error: `El estado "${status}" no existe.` };
  }

  const amountOriginalMinor = Math.round(Number(datos.amountOriginal) * 100);
  if (!Number.isFinite(amountOriginalMinor)) {
    return { ok: false, error: "El importe no es un número." };
  }

  const fxRate = datos.fxRate == null ? null : Number(datos.fxRate);
  const taxPercent = Number(datos.taxPercent ?? 0);

  let amountArsMinor: number;
  try {
    amountArsMinor = computeAmountArsMinor({
      amountOriginalMinor,
      currency,
      fxRate,
      taxPercent,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Importe inválido." };
  }

  return {
    ok: true,
    value: {
      vendorId,
      periodYear,
      periodMonth,
      amountOriginalMinor,
      currency,
      fxRate,
      taxPercent,
      amountArsMinor,
      status,
      notes: datos.notes ? String(datos.notes) : null,
    },
  };
}
