import { arPeriod } from "./readers/parse";

/** Un proveedor que cobra siempre lo mismo y no manda recibo mensual. */
export type FixedCharge = {
  vendorKey: string;
  amount: number;
  currency: "USD";
  /** Día del mes en que se cobra (si el mes es más corto, el último día). */
  day: number;
  since: { year: number; month: number };
  note: string;
};

export const FIXED_CHARGES: readonly FixedCharge[] = [
  {
    vendorKey: "chatgpt",
    amount: 20,
    currency: "USD",
    day: 29,
    // Resuscripción a Plus del 29/09/2026 (decisión de Daniel, 18/10/2026: monto fijo de USD 20).
    since: { year: 2026, month: 9 },
    note: "Cobro fijo: ChatGPT no manda recibo mensual.",
  },
];

/** Meses desde el inicio hasta hoy (hora argentina) que todavía no tienen gasto, con su día de cobro. */
export function missingFixedMonths(
  charge: FixedCharge,
  existing: { periodYear: number; periodMonth: number }[],
  today: Date,
): { periodYear: number; periodMonth: number; date: Date }[] {
  const taken = new Set(existing.map((e) => e.periodYear * 12 + e.periodMonth - 1));
  const now = arPeriod(today);
  const out: { periodYear: number; periodMonth: number; date: Date }[] = [];
  for (let i = charge.since.year * 12 + charge.since.month - 1; i <= now.periodYear * 12 + now.periodMonth - 1; i++) {
    const year = Math.floor(i / 12);
    const month = (i % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const date = new Date(Date.UTC(year, month - 1, Math.min(charge.day, lastDay), 12));
    if (date.getTime() > today.getTime() || taken.has(i)) continue;
    out.push({ periodYear: year, periodMonth: month, date });
  }
  return out;
}
