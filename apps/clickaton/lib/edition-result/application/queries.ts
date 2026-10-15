import "server-only";
import { prisma } from "@/lib/admin/db";
import {
  computeEditionResult,
  type EditionResult,
  type ResultIncomeInput,
} from "../domain/result";

const PAID_STATUSES = ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

/**
 * Lo que entró de verdad: inscripciones pagas (los regalos también son
 * inscripciones) y compras de la tienda. Los reembolsos se restan aparte para
 * que se vean. Nunca cuenta el Modo Test.
 */
export async function loadEditionIncome(editionId: string): Promise<ResultIncomeInput> {
  const [paid, freeCount, storeOrders] = await Promise.all([
    prisma.clickatonRegistration.findMany({
      where: { editionId, isOpsTest: false, paymentStatus: { in: [...PAID_STATUSES] } },
      select: {
        paymentStatus: true,
        totalAmount: true,
        refundedAmountMinor: true,
        giftVoucher: { select: { status: true } },
      },
    }),
    prisma.clickatonRegistration.count({
      where: {
        editionId,
        isOpsTest: false,
        paymentStatus: "NOT_REQUIRED",
        status: "CONFIRMED",
      },
    }),
    prisma.clickatonStoreOrder.findMany({
      where: { editionId, paymentStatus: { in: ["APPROVED", "REFUNDED"] } },
      select: { paymentStatus: true, totalAmount: true },
    }),
  ]);

  let grossCollectedMinor = 0;
  let refundedMinor = 0;
  let paidRegistrations = 0;
  for (const r of paid) {
    grossCollectedMinor += r.totalAmount;
    const fullyRefunded =
      r.paymentStatus === "REFUNDED" || r.giftVoucher?.status === "REFUNDED";
    const refunded = fullyRefunded
      ? Math.max(r.refundedAmountMinor ?? 0, r.totalAmount)
      : (r.refundedAmountMinor ?? 0);
    refundedMinor += Math.min(refunded, r.totalAmount);
    if (!fullyRefunded) paidRegistrations += 1;
  }
  for (const o of storeOrders) {
    grossCollectedMinor += o.totalAmount;
    if (o.paymentStatus === "REFUNDED") refundedMinor += o.totalAmount;
  }

  return { grossCollectedMinor, refundedMinor, paidRegistrations, freeRegistrations: freeCount };
}

export type EditionResultPageData = Awaited<ReturnType<typeof getEditionResultPageData>>;

export async function getEditionResultPageData(editionId: string) {
  const [income, settings, expenses, leftovers, received, otherEditions] = await Promise.all([
    loadEditionIncome(editionId),
    prisma.clickatonEditionResultSettings.findUnique({ where: { editionId } }),
    prisma.clickatonEditionExpense.findMany({
      where: { editionId },
      orderBy: [{ spentAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.clickatonEditionLeftoverItem.findMany({
      where: { editionId },
      orderBy: [{ itemName: "asc" }, { createdAt: "asc" }],
      include: { carriedToEdition: { select: { id: true, name: true } } },
    }),
    prisma.clickatonEditionLeftoverItem.findMany({
      where: { carriedToEditionId: editionId },
      orderBy: [{ itemName: "asc" }],
      include: { edition: { select: { id: true, name: true } } },
    }),
    prisma.clickatonEdition.findMany({
      where: { id: { not: editionId }, isOpsFixture: false },
      orderBy: { startAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const result = computeEditionResult({
    income,
    fees: settings,
    expenses,
    leftovers,
    receivedFromOtherEditions: received,
  });

  return { income, settings, expenses, leftovers, received, otherEditions, result };
}

export type EditionComparisonRow = {
  editionId: string;
  name: string;
  startAt: Date | null;
  result: EditionResult;
};

/** Todas las ediciones reales, en orden, con su resultado. */
export async function getEditionsComparison(): Promise<EditionComparisonRow[]> {
  const editions = await prisma.clickatonEdition.findMany({
    where: { isOpsFixture: false },
    orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, startAt: true },
  });
  const [settings, expenses, leftovers] = await Promise.all([
    prisma.clickatonEditionResultSettings.findMany(),
    prisma.clickatonEditionExpense.findMany({
      select: { editionId: true, amountMinor: true, category: true, paidBy: true, isEstimate: true },
    }),
    prisma.clickatonEditionLeftoverItem.findMany({
      select: { editionId: true, carriedToEditionId: true, quantity: true, unitCostMinor: true },
    }),
  ]);

  return Promise.all(
    editions.map(async (e) => ({
      editionId: e.id,
      name: e.name,
      startAt: e.startAt,
      result: computeEditionResult({
        income: await loadEditionIncome(e.id),
        fees: settings.find((s) => s.editionId === e.id) ?? null,
        expenses: expenses.filter((x) => x.editionId === e.id),
        leftovers: leftovers.filter((x) => x.editionId === e.id),
        receivedFromOtherEditions: leftovers.filter((x) => x.carriedToEditionId === e.id),
      }),
    })),
  );
}
