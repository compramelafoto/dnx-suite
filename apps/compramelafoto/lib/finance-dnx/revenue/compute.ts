import { arPeriod } from "../mail/readers/parse";

/**
 * Comisión estimada de Mercado Pago sobre lo cobrado en FotoRank (el cobro entra entero a la
 * cuenta de DNX, así que esa comisión la paga DNX). No queda guardada en ningún lado: es estimada.
 */
export const FOTORANK_MP_FEE_ESTIMATE = 0.0629;

export type MonthRevenue = {
  grossArs: number;
  processorFeeArs: number;
  payoutToThirdPartiesArs: number;
  netArs: number;
  operationsCount: number;
};

/** Clave "2026-3" de un mes. */
export type MonthKey = string;

export function monthKey(periodYear: number, periodMonth: number): MonthKey {
  return `${periodYear}-${periodMonth}`;
}

function keyOf(date: Date): MonthKey {
  const p = arPeriod(date);
  return monthKey(p.periodYear, p.periodMonth);
}

/** Meses desde `since` hasta el actual (hora argentina). */
export function monthKeysSince(since: { year: number; month: number }, today: Date) {
  const now = arPeriod(today);
  const out: { periodYear: number; periodMonth: number }[] = [];
  for (let i = since.year * 12 + since.month - 1; i <= now.periodYear * 12 + now.periodMonth - 1; i++) {
    out.push({ periodYear: Math.floor(i / 12), periodMonth: (i % 12) + 1 });
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

class Book {
  private months = new Map<MonthKey, MonthRevenue>();

  add(date: Date, part: Partial<Omit<MonthRevenue, "operationsCount">> & { operations?: number }) {
    const k = keyOf(date);
    const m = this.months.get(k) ?? { grossArs: 0, processorFeeArs: 0, payoutToThirdPartiesArs: 0, netArs: 0, operationsCount: 0 };
    m.grossArs = r2(m.grossArs + (part.grossArs ?? 0));
    m.processorFeeArs = r2(m.processorFeeArs + (part.processorFeeArs ?? 0));
    m.payoutToThirdPartiesArs = r2(m.payoutToThirdPartiesArs + (part.payoutToThirdPartiesArs ?? 0));
    m.netArs = r2(m.netArs + (part.netArs ?? 0));
    m.operationsCount += part.operations ?? 0;
    this.months.set(k, m);
  }

  result(): Map<MonthKey, MonthRevenue> {
    return this.months;
  }
}

/**
 * CompraMeLaFoto (montos en pesos enteros, aunque el campo se llame "Cents").
 * Neto = comisión de fotos e impresiones − descuento del fee por saldo de referido − parte de los referidos.
 * La parte de los organizadores sale de la del fotógrafo: no se resta.
 */
export function computeClf(input: {
  orders: { date: Date; total: number; fee: number; referralDiscount: number }[];
  prints: { date: Date; total: number; fee: number }[];
  referrals: { date: Date; amount: number }[];
}): Map<MonthKey, MonthRevenue> {
  const book = new Book();
  for (const o of input.orders) {
    book.add(o.date, { grossArs: o.total, payoutToThirdPartiesArs: o.referralDiscount, netArs: o.fee - o.referralDiscount, operations: 1 });
  }
  for (const p of input.prints) book.add(p.date, { grossArs: p.total, netArs: p.fee, operations: 1 });
  for (const r of input.referrals) book.add(r.date, { payoutToThirdPartiesArs: r.amount, netArs: -r.amount });
  return book.result();
}

/** SubiLaFoto (centavos reales). */
export function computeSubilafoto(orders: { date: Date; amountCents: number; feeCents: number }[]): Map<MonthKey, MonthRevenue> {
  const book = new Book();
  for (const o of orders) book.add(o.date, { grossArs: o.amountCents / 100, netArs: o.feeCents / 100, operations: 1 });
  return book.result();
}

/**
 * FOTOFFICE (pesos). `collected`: cobros por Mercado Pago (su comisión ya incluye la arrastrada de
 * pagos en efectivo que se retuvo ahí). `settledManually`: comisión adeudada que se dio por saldada.
 * La comisión de un pago en efectivo no cuenta cuando se cobra, sino cuando se retiene o se salda.
 */
export function computeFotoffice(input: {
  collected: { date: Date; gross: number; fee: number }[];
  settledManually: { date: Date; amount: number }[];
}): Map<MonthKey, MonthRevenue> {
  const book = new Book();
  for (const c of input.collected) book.add(c.date, { grossArs: c.gross, netArs: c.fee, operations: 1 });
  for (const s of input.settledManually) book.add(s.date, { netArs: s.amount, operations: 1 });
  return book.result();
}

/** FotoRank (centavos). DNX cobra todo, se queda con su porcentaje y paga la comisión de MP. */
export function computeFotorank(registrations: { date: Date; priceCents: number; feeBps: number }[]): Map<MonthKey, MonthRevenue> {
  const book = new Book();
  for (const r of registrations) {
    const gross = r.priceCents / 100;
    const fee = r2((gross * r.feeBps) / 10_000);
    const mp = r2(gross * FOTORANK_MP_FEE_ESTIMATE);
    book.add(r.date, { grossArs: gross, processorFeeArs: mp, payoutToThirdPartiesArs: r2(gross - fee), netArs: r2(fee - mp), operations: 1 });
  }
  return book.result();
}
