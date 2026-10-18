import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

/** Comisión de FOTOFFICE que efectivamente entró: cobros por Mercado Pago y comisión saldada a mano. */
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
  const debt = await db.workspaceFeeLedgerEntry.aggregate({ _sum: { amountArs: true } });
  return { collected, settledManually, pendingFeeDebtArs: Math.max(0, n(debt._sum.amountArs)) };
}

/** Inscripciones pagas de FotoRank (misma base que FOTOFFICE). Centavos. */
export async function loadFotorankRows() {
  const rows = await fotofficeDb().fotorankContestRegistration.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: SINCE_DATE } },
    select: { createdAt: true, registrationPriceSnapshot: true, platformFeeBpsSnapshot: true },
  });
  return rows.map((r) => ({ date: r.createdAt, priceCents: r.registrationPriceSnapshot, feeBps: r.platformFeeBpsSnapshot }));
}
