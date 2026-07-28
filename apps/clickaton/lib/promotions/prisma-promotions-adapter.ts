import {
  buildRedeemCommand,
  normalizePromotionCode,
  previewPromotion,
  type PreviewPromotionResult,
  type PromotionQuote,
  type PromotionRecord,
  type RedeemPromotionCommand,
} from "@repo/promotions";
import { prisma } from "@repo/db";

export const CLICKATON_PROMOTION_PLATFORM = "CLICKATON" as const;

function mapPromotion(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumPurchaseAmount: number | null;
  startsAt: Date;
  endsAt: Date;
  totalUsageLimit: number | null;
  perUserUsageLimit: number | null;
  isActive: boolean;
  platform: string;
  editionId: string | null;
  metadata: unknown;
}): PromotionRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscountAmount: row.maxDiscountAmount,
    minimumPurchaseAmount: row.minimumPurchaseAmount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    totalUsageLimit: row.totalUsageLimit,
    perUserUsageLimit: row.perUserUsageLimit,
    isActive: row.isActive,
    platform: row.platform,
    editionId: row.editionId,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

async function usageCounters(promotionId: string, userId: number | null | undefined) {
  const activeStatuses = ["RESERVED", "CONFIRMED"] as const;
  const totalActiveRedemptions = await prisma.dnxPromotionRedemption.count({
    where: { promotionId, status: { in: [...activeStatuses] } },
  });
  let userActiveRedemptions = 0;
  if (userId != null) {
    userActiveRedemptions = await prisma.dnxPromotionRedemption.count({
      where: {
        promotionId,
        userId,
        status: { in: [...activeStatuses] },
      },
    });
  }
  return { totalActiveRedemptions, userActiveRedemptions };
}

export async function findPromotionByCode(
  rawCode: string,
  platform = CLICKATON_PROMOTION_PLATFORM,
): Promise<PromotionRecord | null> {
  const code = normalizePromotionCode(rawCode);
  if (!code) return null;
  const row = await prisma.dnxPromotion.findUnique({ where: { code } });
  if (!row || row.platform !== platform) return null;
  return mapPromotion(row);
}

export async function previewClickatonPromotion(input: {
  code: string;
  originalAmount: number;
  currency: string;
  editionId: string;
  userId?: number | null;
  now?: Date;
}): Promise<PreviewPromotionResult> {
  const promotion = await findPromotionByCode(input.code);
  if (!promotion) {
    return {
      ok: false,
      code: "CODE_NOT_FOUND",
      message: "Código promocional no válido.",
    };
  }
  const usage = await usageCounters(promotion.id, input.userId);
  return previewPromotion({
    promotion,
    usage,
    originalAmount: input.originalAmount,
    currency: input.currency,
    platform: CLICKATON_PROMOTION_PLATFORM,
    editionId: input.editionId,
    userId: input.userId,
    now: input.now,
  });
}

export type AppliedPromotion = {
  quote: PromotionQuote;
  command: RedeemPromotionCommand;
};

/**
 * Reserva redención de forma idempotente dentro de la misma operación de inscripción.
 * Si la key ya existe, reutiliza el snapshot previo.
 */
export async function attachPromotionRedemptionRegistration(input: {
  idempotencyKey: string;
  registrationId: string;
}): Promise<void> {
  await prisma.dnxPromotionRedemption.updateMany({
    where: {
      idempotencyKey: input.idempotencyKey,
      status: { in: ["RESERVED", "CONFIRMED"] },
    },
    data: {
      registrationId: input.registrationId,
      orderId: input.registrationId,
    },
  });
}

export async function reserveClickatonPromotion(input: {
  code: string;
  originalAmount: number;
  currency: string;
  editionId: string;
  userId: number | null;
  /** Puede ser null hasta crear la inscripción; se usa orderId = idempotencyKey del request. */
  registrationId?: string | null;
  orderId: string;
  idempotencyKey: string;
  now?: Date;
}): Promise<
  | { ok: true; applied: AppliedPromotion }
  | { ok: false; code: string; message: string }
> {
  const existing = await prisma.dnxPromotionRedemption.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { promotion: true },
  });
  if (existing) {
    if (existing.status === "RELEASED") {
      return {
        ok: false,
        code: "CODE_INACTIVE",
        message: "Esta redención fue liberada. Intentá de nuevo con un código vigente.",
      };
    }
    return {
      ok: true,
      applied: {
        quote: {
          promotionId: existing.promotionId,
          code: existing.promotion.code,
          name: existing.promotion.name,
          discountType: existing.promotion.discountType,
          discountValue: existing.promotion.discountValue,
          originalAmount: existing.originalAmount,
          discountAmount: existing.discountAmount,
          finalAmount: existing.finalAmount,
          currency: existing.currency,
        },
        command: {
          promotionId: existing.promotionId,
          userId: existing.userId,
          registrationId: existing.registrationId,
          orderId: existing.orderId,
          originalAmount: existing.originalAmount,
          discountAmount: existing.discountAmount,
          finalAmount: existing.finalAmount,
          currency: existing.currency,
          platform: existing.platform,
          editionId: existing.editionId,
          idempotencyKey: existing.idempotencyKey,
          status: existing.status,
        },
      },
    };
  }

  const promotion = await findPromotionByCode(input.code);
  if (!promotion) {
    return { ok: false, code: "CODE_NOT_FOUND", message: "Código promocional no válido." };
  }
  const usage = await usageCounters(promotion.id, input.userId);
  const built = buildRedeemCommand({
    promotion,
    usage,
    originalAmount: input.originalAmount,
    currency: input.currency,
    platform: CLICKATON_PROMOTION_PLATFORM,
    editionId: input.editionId,
    userId: input.userId,
    orderId: input.orderId,
    registrationId: input.registrationId ?? null,
    idempotencyKey: input.idempotencyKey,
    now: input.now,
  });
  if (!built.ok || built.kind !== "redeem") {
    return built.ok
      ? { ok: false, code: "INVALID_PROMOTION", message: "No se pudo reservar la promoción." }
      : built;
  }

  try {
    await prisma.dnxPromotionRedemption.create({
      data: {
        promotionId: built.command.promotionId,
        userId: built.command.userId,
        registrationId: built.command.registrationId,
        orderId: built.command.orderId,
        originalAmount: built.command.originalAmount,
        discountAmount: built.command.discountAmount,
        finalAmount: built.command.finalAmount,
        currency: built.command.currency,
        platform: built.command.platform,
        editionId: built.command.editionId,
        status: "RESERVED",
        idempotencyKey: built.command.idempotencyKey,
      },
    });
  } catch (err) {
    // Carrera de idempotencia: reintentar lectura.
    const raced = await prisma.dnxPromotionRedemption.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { promotion: true },
    });
    if (raced && raced.status !== "RELEASED") {
      return {
        ok: true,
        applied: {
          quote: {
            promotionId: raced.promotionId,
            code: raced.promotion.code,
            name: raced.promotion.name,
            discountType: raced.promotion.discountType,
            discountValue: raced.promotion.discountValue,
            originalAmount: raced.originalAmount,
            discountAmount: raced.discountAmount,
            finalAmount: raced.finalAmount,
            currency: raced.currency,
          },
          command: {
            promotionId: raced.promotionId,
            userId: raced.userId,
            registrationId: raced.registrationId,
            orderId: raced.orderId,
            originalAmount: raced.originalAmount,
            discountAmount: raced.discountAmount,
            finalAmount: raced.finalAmount,
            currency: raced.currency,
            platform: raced.platform,
            editionId: raced.editionId,
            idempotencyKey: raced.idempotencyKey,
            status: raced.status,
          },
        },
      };
    }
    throw err;
  }

  return { ok: true, applied: { quote: built.quote, command: built.command } };
}

export async function confirmClickatonPromotionRedemption(registrationId: string): Promise<void> {
  await prisma.dnxPromotionRedemption.updateMany({
    where: {
      registrationId,
      status: "RESERVED",
    },
    data: { status: "CONFIRMED" },
  });
}

export async function releaseClickatonPromotionRedemption(registrationId: string): Promise<number> {
  const result = await prisma.dnxPromotionRedemption.updateMany({
    where: {
      registrationId,
      status: { in: ["RESERVED", "CONFIRMED"] },
    },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
  });
  return result.count;
}

export async function listClickatonPromotions(editionId?: string | null) {
  return prisma.dnxPromotion.findMany({
    where: {
      platform: CLICKATON_PROMOTION_PLATFORM,
      ...(editionId
        ? { OR: [{ editionId }, { editionId: null }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function countPromotionRedemptions(promotionId: string) {
  const [active, released, total] = await Promise.all([
    prisma.dnxPromotionRedemption.count({
      where: { promotionId, status: { in: ["RESERVED", "CONFIRMED"] } },
    }),
    prisma.dnxPromotionRedemption.count({
      where: { promotionId, status: "RELEASED" },
    }),
    prisma.dnxPromotionRedemption.count({ where: { promotionId } }),
  ]);
  return { active, released, total };
}
