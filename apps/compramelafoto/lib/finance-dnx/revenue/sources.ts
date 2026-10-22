import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { digitalizacionWithheldArs, pendingFeeDebtByWorkspace } from "./compute";

/** Los ingresos se calculan desde acá (decisión de Daniel, 18/10/2026). */
export const REVENUE_SINCE = { year: 2026, month: 1 };
const SINCE_DATE = new Date(Date.UTC(REVENUE_SINCE.year, REVENUE_SINCE.month - 1, 1, 3)); // 00:00 en Argentina

const n = (v: { toNumber(): number } | number | null | undefined) => (v == null ? 0 : typeof v === "number" ? v : v.toNumber());

/** Ventas de CompraMeLaFoto (misma base que Finanzas). Montos en pesos enteros. */
export async function loadClfRows() {
  const [orders, prints, referrals] = await Promise.all([
    prisma.order.findMany({
      where: { status: "PAID", isTest: false, createdAt: { gte: SINCE_DATE } },
      select: { createdAt: true, totalCents: true, platformCommissionCents: true, referralFeeDiscountCents: true },
    }),
    prisma.printOrder.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: SINCE_DATE } },
      select: { createdAt: true, total: true, platformCommission: true },
    }),
    prisma.referralEarning.findMany({
      where: { reversedAt: null, createdAt: { gte: SINCE_DATE } },
      select: { createdAt: true, referralAmountCents: true },
    }),
  ]);
  return {
    orders: orders.map((o) => ({
      date: o.createdAt,
      total: n(o.totalCents),
      fee: n(o.platformCommissionCents),
      referralDiscount: n(o.referralFeeDiscountCents),
    })),
    prints: prints.map((p) => ({ date: p.createdAt, total: n(p.total), fee: n(p.platformCommission) })),
    referrals: referrals.map((r) => ({ date: r.createdAt, amount: n(r.referralAmountCents) })),
  };
}

/** Ventas de SubiLaFoto (vive en la base de CLF). Centavos reales. */
export async function loadSubilafotoRows() {
  const rows = await prisma.subilafotoOrder.findMany({
    where: { status: "PAID", refundedAt: null, paidAt: { gte: SINCE_DATE } },
    select: { paidAt: true, amountCents: true, platformFeeCents: true },
  });
  return rows.map((r) => ({ date: r.paidAt as Date, amountCents: r.amountCents, feeCents: r.platformFeeCents }));
}

const globalForFotoffice = globalThis as unknown as { fotofficeRevenueDb?: PrismaClient };

/**
 * Base de FOTOFFICE y FotoRank, sólo para leer. Este módulo sólo hace `findMany`; la variable
 * debería apuntar a un rol de Postgres de sólo lectura.
 */
function fotofficeDb(): PrismaClient {
  const url = process.env.FOTOFFICE_READONLY_DATABASE_URL?.trim();
  if (!url) throw new Error("Falta FOTOFFICE_READONLY_DATABASE_URL (base de FOTOFFICE y FotoRank, sólo lectura).");
  globalForFotoffice.fotofficeRevenueDb ??= new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
  return globalForFotoffice.fotofficeRevenueDb;
}

const MP_METHOD = /^mercado_?pago$/i;

/**
 * Comisión de FOTOFFICE que efectivamente entró: cobros por Mercado Pago (socios, cursos, reservas,
 * tienda y pedidos de Digitalización) y comisión saldada a mano. El saldo pendiente se suma por negocio.
 */
export async function loadFotofficeRows() {
  const db = fotofficeDb();
  const [cuotas, cursos, reservas, tienda, saldadas] = await Promise.all([
    db.membershipPayment.findMany({
      where: { status: "ACREDITADO", paidAt: { gte: SINCE_DATE } },
      select: { paidAt: true, method: true, amountArs: true, platformFeeArs: true },
    }),
    db.courseEnrollment.findMany({
      where: { paymentStatus: "APPROVED", paymentMethod: "MERCADO_PAGO", createdAt: { gte: SINCE_DATE } },
      select: { createdAt: true, amountArs: true, platformFeeArs: true },
    }),
    db.booking.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: SINCE_DATE } },
      select: { paidAt: true, createdAt: true, paymentMethod: true, totalArs: true, feeArs: true },
    }),
    db.storeOrder.findMany({
      where: { status: { in: ["PAID", "READY", "DELIVERED"] }, createdAt: { gte: SINCE_DATE } },
      select: { paidAt: true, createdAt: true, totalArs: true, feeArs: true },
    }),
    db.workspaceFeeLedgerEntry.findMany({
      where: { kind: "SALDADO_MANUAL", createdAt: { gte: SINCE_DATE } },
      select: { createdAt: true, amountArs: true },
    }),
  ]);
  const collected = [
    ...cuotas
      .filter((c) => c.paidAt && MP_METHOD.test(c.method ?? ""))
      .map((c) => ({ date: c.paidAt as Date, gross: n(c.amountArs), fee: n(c.platformFeeArs) })),
    ...cursos.map((c) => ({ date: c.createdAt, gross: n(c.amountArs), fee: n(c.platformFeeArs) })),
    ...reservas
      .filter((b) => /mercado/i.test(b.paymentMethod))
      .map((b) => ({ date: b.paidAt ?? b.createdAt, gross: n(b.totalArs), fee: n(b.feeArs) })),
    ...tienda.map((s) => ({ date: s.paidAt ?? s.createdAt, gross: n(s.totalArs), fee: n(s.feeArs) })),
  ];
  const settledManually = saldadas.map((s) => ({ date: s.createdAt, amount: Math.abs(n(s.amountArs)) }));
  const debt = await db.workspaceFeeLedgerEntry.groupBy({ by: ["workspaceId"], _sum: { amountArs: true } });
  return {
    collected: [...collected, ...(await loadDigitalizacionCollected(db))],
    settledManually,
    pendingFeeDebtArs: pendingFeeDebtByWorkspace(debt.map((d) => ({ workspaceId: d.workspaceId, amountArs: n(d._sum.amountArs) }))),
  };
}

/**
 * Comisión de plataforma cobrada por Mercado Pago en pedidos de Digitalización de otros negocios.
 * Cada cobro con comisión tiene su marca (`DigitalizacionComision`); sólo cuentan los que apuntan a un
 * RETENIDO (un 0 también: la retención fue sólo su comisión propia). Si la marca apunta a un REVERSADO,
 * Mercado Pago devolvió el pago y no cuenta. Los DEVENGADO (cobros manuales) no entraron todavía:
 * cuentan cuando se retienen en otro pago o se saldan a mano. Monto: ver `digitalizacionWithheldArs`.
 */
async function loadDigitalizacionCollected(db: PrismaClient) {
  const marcas = await db.digitalizacionComision.findMany({ select: { workspaceId: true, cobroId: true, ledgerEntryId: true } });
  if (marcas.length === 0) return [];
  const [asientos, cobros] = await Promise.all([
    db.workspaceFeeLedgerEntry.findMany({
      where: { kind: "RETENIDO", id: { in: marcas.map((m) => m.ledgerEntryId) } },
      select: { id: true, workspaceId: true, amountArs: true, note: true },
    }),
    db.fotofficeCobro.findMany({
      where: { id: { in: marcas.map((m) => m.cobroId) }, paidAt: { gte: SINCE_DATE } },
      select: { id: true, workspaceId: true, paidAt: true, amountArs: true },
    }),
  ]);
  const asientoPorId = new Map(asientos.map((a) => [a.id, a]));
  const cobroPorId = new Map(cobros.map((c) => [c.id, c]));
  return marcas.flatMap((m) => {
    const asiento = asientoPorId.get(m.ledgerEntryId);
    const cobro = cobroPorId.get(m.cobroId);
    if (!asiento || !cobro || asiento.workspaceId !== m.workspaceId || cobro.workspaceId !== m.workspaceId) return [];
    return [{ date: cobro.paidAt, gross: n(cobro.amountArs), fee: digitalizacionWithheldArs({ amountArs: n(asiento.amountArs), note: asiento.note }) }];
  });
}

/** Inscripciones pagas de FotoRank (misma base que FOTOFFICE). Centavos. */
export async function loadFotorankRows() {
  const rows = await fotofficeDb().fotorankContestRegistration.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: SINCE_DATE } },
    select: { createdAt: true, registrationPriceSnapshot: true, platformFeeBpsSnapshot: true },
  });
  return rows.map((r) => ({ date: r.createdAt, priceCents: r.registrationPriceSnapshot, feeBps: r.platformFeeBpsSnapshot }));
}
