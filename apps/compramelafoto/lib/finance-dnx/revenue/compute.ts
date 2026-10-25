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
 * Saldo de comisión que los negocios de FOTOFFICE le deben a la plataforma: el libro sumado POR
 * NEGOCIO, con piso 0 en cada uno. Un negocio con saldo a favor (negativo) no tapa la deuda de otro.
 */
export function pendingFeeDebtByWorkspace(sums: { workspaceId: string; amountArs: number }[]): number {
  const perWorkspace = new Map<string, number>();
  for (const s of sums) perWorkspace.set(s.workspaceId, (perWorkspace.get(s.workspaceId) ?? 0) + s.amountArs);
  let total = 0;
  for (const v of perWorkspace.values()) total += Math.max(0, r2(v));
  return r2(total);
}

/** Pesos con formato es-AR ("1.234,56" o "1.234") a centavos; null si no tiene esa forma. */
function arPesosToMinor(s: string): number | null {
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(",");
  return Number(int.replace(/\./g, "")) * 100 + Number(dec.padEnd(2, "0"));
}

/** Cola de la nota de un RETENIDO de digitalización (`notaRetenido` en FOTOFFICE). */
const RETENIDO_NOTE_TAIL = /· (\S+) pesos \((\S+) pesos de este cobro y (\S+) pesos de deuda\)$/;

/**
 * Lo que la plataforma cobró por Mercado Pago en un cobro de un pedido de Digitalización, a partir de
 * su asiento RETENIDO (pesos).
 *
 * El libro sólo guarda, como monto, la parte que canceló deuda (negativa). La comisión propia de ese
 * cobro no queda en ninguna columna aparte: `FotofficeCobro.feeArs` la mezcla con la comisión de
 * Mercado Pago, que no se guarda separada. Lo único que la registra es la nota del asiento
 * ("… · R pesos (P pesos de este cobro y D pesos de deuda)"), que se usa sólo si es coherente con el
 * libro: D tiene que ser exactamente el monto del asiento y P + D no puede pasar de R. Entonces se
 * cuenta R (todo el `application_fee` que retuvo Mercado Pago para la plataforma).
 *
 * Limitación: si la nota no se puede leer o no cierra con el libro, se cuenta sólo la deuda cobrada
 * (el monto del asiento) y la comisión propia de ese cobro queda afuera.
 */
export function digitalizacionWithheldArs(entry: { amountArs: number; note: string | null }): number {
  const debtMinor = Math.round(Math.abs(entry.amountArs) * 100);
  const m = entry.note ? RETENIDO_NOTE_TAIL.exec(entry.note) : null;
  if (m) {
    const [retenido, propio, deuda] = [arPesosToMinor(m[1]), arPesosToMinor(m[2]), arPesosToMinor(m[3])];
    if (retenido !== null && propio !== null && deuda !== null && deuda === debtMinor && propio + deuda <= retenido) return retenido / 100;
  }
  return debtMinor / 100;
}

/**
 * FOTOFFICE (pesos). `collected`: cobros por Mercado Pago (su comisión ya incluye la arrastrada de
 * pagos en efectivo que se retuvo ahí), incluidos los de pedidos de Digitalización (ver
 * `digitalizacionWithheldArs`). `settledManually`: comisión adeudada que se dio por saldada.
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
