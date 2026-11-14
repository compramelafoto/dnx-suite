import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADVANCE_USD_CENTS, isIntlPilotUser } from "./pilot";
import { computeWallet } from "./wallet";

const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function getWalletState(userId: number) {
  const movements = await prisma.clfIntlWalletMovement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const { balanceUsdCents, advanceDebtUsdCents } = computeWallet(movements);
  const since = Date.now() - 30 * DAY_MS;
  const last30DaysCommissionUsdCents = movements
    .filter((m) => m.type === "COMMISSION" && m.createdAt.getTime() >= since)
    .reduce((acc, m) => acc - m.amountUsdCents, 0);
  return { balanceUsdCents, advanceDebtUsdCents, last30DaysCommissionUsdCents, movements };
}

/** Da el adelanto de 25 USD una sola vez por cuenta de Mercado Pago. */
export async function ensureAdvanceGranted(userId: number): Promise<"GRANTED" | "ALREADY" | "NOT_ELIGIBLE"> {
  if (!isIntlPilotUser(userId)) return "NOT_ELIGIBLE";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mpUserId: true } });
  const mpUserId = user?.mpUserId ? String(user.mpUserId) : null;
  if (!mpUserId) return "NOT_ELIGIBLE";
  const sameAccount = await prisma.user.findMany({ where: { mpUserId }, select: { id: true } });
  const ids = sameAccount.map((u) => u.id);
  const existing = await prisma.clfIntlWalletMovement.findFirst({
    where: { type: "ADVANCE", userId: { in: ids } },
    select: { userId: true },
  });
  if (existing) return existing.userId === userId ? "ALREADY" : "NOT_ELIGIBLE";
  try {
    await prisma.clfIntlWalletMovement.create({
      data: {
        userId,
        type: "ADVANCE",
        amountUsdCents: ADVANCE_USD_CENTS,
        externalRef: `advance:mp:${mpUserId}`,
        note: "Adelanto inicial del piloto",
      },
    });
    return "GRANTED";
  } catch (err) {
    if (isUniqueViolation(err)) return "ALREADY";
    throw err;
  }
}

/** Descuenta la comisión de un pedido. Una sola vez por pedido (índice único orderId + type). */
export async function recordCommission(params: {
  userId: number;
  orderId: number;
  localCurrency: string;
  localAmount: number;
  fxRateId: string | null;
  fxUnitsPerUsd: string | null;
  amountUsdCents: number;
}): Promise<{ created: boolean; balanceBefore: number; balanceAfter: number }> {
  const before = (await getWalletState(params.userId)).balanceUsdCents;
  try {
    await prisma.clfIntlWalletMovement.create({
      data: {
        userId: params.userId,
        type: "COMMISSION",
        amountUsdCents: -Math.abs(params.amountUsdCents),
        orderId: params.orderId,
        localCurrency: params.localCurrency,
        localAmount: params.localAmount,
        fxRateId: params.fxRateId,
        fxUnitsPerUsd: params.fxUnitsPerUsd,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false, balanceBefore: before, balanceAfter: before };
    throw err;
  }
  return { created: true, balanceBefore: before, balanceAfter: before - Math.abs(params.amountUsdCents) };
}

/** Registra una recarga de PayPal (y la devolución del adelanto, si la incluye). Una vez por captura. */
export async function recordTopUp(params: {
  userId: number;
  captureId: string;
  paidUsdCents: number;
  chosenUsdCents: number;
  advanceRepaidUsdCents: number;
}): Promise<{ created: boolean }> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.clfIntlWalletMovement.create({
        data: {
          userId: params.userId,
          type: "TOPUP",
          amountUsdCents: params.chosenUsdCents,
          externalRef: params.captureId,
          note: JSON.stringify({ paidUsdCents: params.paidUsdCents }),
        },
      });
      if (params.advanceRepaidUsdCents > 0) {
        await tx.clfIntlWalletMovement.create({
          data: {
            userId: params.userId,
            type: "ADVANCE_REPAID",
            amountUsdCents: 0,
            externalRef: `${params.captureId}:advance`,
            note: JSON.stringify({ repaidUsdCents: params.advanceRepaidUsdCents }),
          },
        });
      }
    });
    return { created: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false };
    throw err;
  }
}

export async function recordAdjustment(params: {
  userId: number;
  amountUsdCents: number;
  note: string;
  createdByUserId: number;
}): Promise<void> {
  await prisma.clfIntlWalletMovement.create({
    data: {
      userId: params.userId,
      type: "ADJUSTMENT",
      amountUsdCents: Math.round(params.amountUsdCents),
      note: params.note,
      createdByUserId: params.createdByUserId,
    },
  });
}
