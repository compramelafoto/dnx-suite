import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitAmountByAllocation } from "@repo/finance-control";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";

import type { EntryLite, NewEntry } from "./decide";
import { FIXED_CHARGES, missingFixedMonths } from "./fixed-charges";
import { createFxLookup } from "./fx";
import { UNKNOWN_FORMAT, processMessages, type PendingMail, type ProcessPorts, type VendorBook } from "./process";
import { readMail } from "./readers";

/** Mails procesados por corrida: el resto sigue en la próxima. */
const BATCH = 300;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toLite(e: {
  id: number;
  periodYear: number;
  periodMonth: number;
  amountOriginal: Prisma.Decimal;
  currency: string;
  status: string;
  source: string;
  invoiceNumber: string | null;
  notes: string | null;
  amountRefunded: Prisma.Decimal | null;
  paidAt: Date | null;
}): EntryLite {
  return {
    ...e,
    amountOriginal: e.amountOriginal.toNumber(),
    amountRefunded: e.amountRefunded ? e.amountRefunded.toNumber() : null,
  };
}

async function allocationRows(tx: Prisma.TransactionClient, vendorId: number, amountArs: number) {
  const shares = await tx.vendorAllocation.findMany({ where: { vendorId } });
  if (shares.length === 0) throw new Error("El proveedor no tiene reparto por plataforma.");
  return splitAmountByAllocation(
    Math.round(amountArs * 100),
    shares.map((s) => ({ platformKey: s.platformKey, sharePercent: s.sharePercent.toNumber() })),
  ).map((p) => ({ platformKey: p.platformKey, sharePercent: p.sharePercent, amountArs: p.amountArsMinor / 100 }));
}

async function createEntryRow(vendorId: number, entry: NewEntry, fx: number | null, notes: string): Promise<number> {
  const amountArs = entry.currency === "USD" && fx !== null ? round2(entry.amount * fx) : entry.amount;
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.expenseEntry.create({
        data: {
          vendorId,
          periodYear: entry.periodYear,
          periodMonth: entry.periodMonth,
          amountOriginal: entry.amount,
          currency: entry.currency,
          fxRate: entry.currency === "USD" ? fx : null,
          // El dólar tarjeta ya incluye los impuestos.
          taxPercent: 0,
          amountArs,
          amountRefunded: entry.amountRefunded,
          status: entry.status,
          source: "MAIL",
          invoiceNumber: entry.invoiceNumber,
          paidAt: entry.paidAt,
          notes,
          allocations: { create: await allocationRows(tx, vendorId, amountArs) },
        },
      });
      return created.id;
    });
  } catch (err: any) {
    // Otra corrida cargó la misma factura en el medio: se usa esa.
    if (err?.code === "P2002" && entry.invoiceNumber) {
      const existing = await prisma.expenseEntry.findFirst({ where: { vendorId, invoiceNumber: entry.invoiceNumber } });
      if (existing) return existing.id;
    }
    throw err;
  }
}

function prismaProcessPorts(fxFor: (d: Date) => Promise<number | null>): ProcessPorts {
  return {
    async loadVendor(vendorKey) {
      const vendor = await prisma.expenseVendor.findUnique({
        where: { key: vendorKey },
        select: {
          id: true,
          entries: {
            select: {
              id: true, periodYear: true, periodMonth: true, amountOriginal: true, currency: true, status: true,
              source: true, invoiceNumber: true, notes: true, amountRefunded: true, paidAt: true,
            },
          },
        },
      });
      return vendor ? { id: vendor.id, entries: vendor.entries.map(toLite) } : null;
    },
    fxFor,
    createEntry(vendor: VendorBook, entry: NewEntry, fx: number | null, mail: PendingMail) {
      const fecha = mail.receivedAt.toISOString().slice(0, 10);
      return createEntryRow(vendor.id, entry, fx, `Cargado automáticamente del mail "${mail.subject}" (${fecha}).`.slice(0, 500));
    },
    async updateEntry(entryId, changes, fx) {
      await prisma.$transaction(async (tx) => {
        const { amountOriginal, ...rest } = changes;
        if (amountOriginal === undefined) {
          await tx.expenseEntry.update({ where: { id: entryId }, data: rest });
          return;
        }
        const current = await tx.expenseEntry.findUniqueOrThrow({ where: { id: entryId } });
        const rate = current.fxRate ? current.fxRate.toNumber() : fx;
        const amountArs = current.currency === "USD" && rate !== null ? round2(amountOriginal * rate) : amountOriginal;
        await tx.expenseEntryAllocation.deleteMany({ where: { entryId } });
        await tx.expenseEntry.update({
          where: { id: entryId },
          data: {
            ...rest,
            amountOriginal,
            amountArs,
            fxRate: current.currency === "USD" ? rate : null,
            allocations: { create: await allocationRows(tx, current.vendorId, amountArs) },
          },
        });
      });
    },
    async markMessage(id, data) {
      await prisma.expenseMailMessage.update({ where: { id }, data: { ...data, reviewReason: data.reviewReason?.slice(0, 500) ?? null } });
    },
    async notify(text) {
      return (await sendTelegramMessage(readBotConfig().telegram, text)).ok;
    },
  };
}

/** ¿Hay un aviso de cobro fallido de ese proveedor cerca de la fecha de cobro? */
async function chargeFailedAround(vendorKey: string, date: Date): Promise<boolean> {
  const mails = await prisma.expenseMailMessage.findMany({
    where: {
      vendorKey,
      receivedAt: { gte: new Date(date.getTime() - 3 * 86_400_000), lte: new Date(date.getTime() + 10 * 86_400_000) },
    },
    select: { fromAddress: true, subject: true, bodyText: true, receivedAt: true },
  });
  return mails.some((m) => {
    const r = readMail(vendorKey, m);
    return r !== null && "ignore" in r && Boolean(r.alert);
  });
}

/** Cobros fijos sin recibo (ChatGPT): un gasto por cada mes que falte; rechazado si el proveedor avisó un fallo. */
async function applyFixedCharges(fxFor: (d: Date) => Promise<number | null>, today: Date): Promise<number> {
  let created = 0;
  for (const charge of FIXED_CHARGES) {
    const vendor = await prisma.expenseVendor.findUnique({
      where: { key: charge.vendorKey },
      select: { id: true, entries: { select: { periodYear: true, periodMonth: true } } },
    });
    if (!vendor) continue;
    for (const m of missingFixedMonths(charge, vendor.entries, today)) {
      const fx = await fxFor(m.date);
      if (fx === null) continue;
      const failed = await chargeFailedAround(charge.vendorKey, m.date);
      await createEntryRow(
        vendor.id,
        {
          periodYear: m.periodYear,
          periodMonth: m.periodMonth,
          amount: charge.amount,
          currency: charge.currency,
          status: failed ? "RECHAZADO" : "PAGADO",
          invoiceNumber: null,
          paidAt: failed ? null : m.date,
          amountRefunded: null,
        },
        fx,
        failed ? `${charge.note} El proveedor avisó que no pudo cobrar.` : charge.note,
      );
      created++;
    }
  }
  return created;
}

export type ProcessSummary = { loaded: number; review: number; ignored: number; fixed: number };

/** Convierte en gastos los mails pendientes y completa los cobros fijos, dentro del tiempo disponible. */
export async function processPendingMail(opts: { deadlineMs: number; now?: Date }): Promise<ProcessSummary> {
  const now = opts.now ?? new Date();
  const fxFor = createFxLookup({ today: now });
  const rows = await prisma.expenseMailMessage.findMany({
    // Los formatos desconocidos no se releen en cada corrida: si no, el historial ilegible tapa a los mails nuevos.
    where: {
      status: "PARA_REVISAR",
      vendorKey: { not: null },
      OR: [{ reviewReason: null }, { NOT: { reviewReason: { startsWith: UNKNOWN_FORMAT } } }],
    },
    orderBy: { receivedAt: "asc" },
    take: BATCH,
    select: { id: true, vendorKey: true, fromAddress: true, subject: true, bodyText: true, receivedAt: true, alertedAt: true },
  });
  const mails: PendingMail[] = rows.map((r) => ({ ...r, vendorKey: r.vendorKey as string }));
  const totals = await processMessages(mails, prismaProcessPorts(fxFor), now, { deadlineMs: opts.deadlineMs });
  const fixed = Date.now() < opts.deadlineMs ? await applyFixedCharges(fxFor, now) : 0;
  return { ...totals, fixed };
}
