import { ReferralProgram } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { REFERRAL_PROGRAM_FEE_SHARE } from "@/lib/referral/referral-program";

/** Saldo de comisiones por referidos disponibles para descontar del fee (ARS enteros; convención *Cents del módulo referidos). */
export async function getReferralSellerBalanceCents(sellerUserId: number): Promise<number> {
  const agg = await prisma.referralEarning.aggregate({
    where: {
      attribution: { referrerUserId: sellerUserId },
      paidOutAt: null,
      reversedAt: null,
      appliedAt: null,
    },
    _sum: { referralAmountCents: true },
  });
  return agg._sum.referralAmountCents ?? 0;
}

export type ReferralDiscountResult = {
  marketplaceFeeCents: number;
  discountCents: number;
};

/** Aplica descuento por saldo referido al marketplace_fee (solo la parte fee plataforma). Función pura. */
export function applyReferralDiscountToMarketplaceFeeAmount(params: {
  marketplaceFeeCents: number;
  referralBalanceCents: number;
}): ReferralDiscountResult {
  const gross = Math.max(0, Math.round(Number(params.marketplaceFeeCents) || 0));
  const balance = Math.max(0, Math.round(Number(params.referralBalanceCents) || 0));
  if (gross <= 0 || balance <= 0) {
    return { marketplaceFeeCents: gross, discountCents: 0 };
  }
  const discountCents = Math.min(gross, balance);
  return {
    marketplaceFeeCents: Math.max(0, gross - discountCents),
    discountCents,
  };
}

export async function applySellerReferralDiscountToMarketplaceFee(params: {
  sellerUserId: number | null | undefined;
  marketplaceFeeCents: number;
}): Promise<ReferralDiscountResult> {
  const gross = Math.max(0, Math.round(Number(params.marketplaceFeeCents) || 0));
  const sellerId = params.sellerUserId;
  if (sellerId == null || gross <= 0) {
    return { marketplaceFeeCents: gross, discountCents: 0 };
  }
  const balance = await getReferralSellerBalanceCents(sellerId);
  return applyReferralDiscountToMarketplaceFeeAmount({
    marketplaceFeeCents: gross,
    referralBalanceCents: balance,
  });
}

export type ReferralEarningAmounts = {
  /** Fee plataforma efectivamente retenido por MP (post-descuento saldo vendedor). ARS enteros. */
  effectivePlatformFeeCents: number;
  referralAmountCents: number;
  platformNetCents: number;
};

/** Fee plataforma atribuible a reparto (bruto − descuento saldo referido del vendedor). */
export function computeEffectivePlatformFeeCents(params: {
  grossPlatformFeeCents: number;
  referralFeeDiscountCents?: number | null;
}): number | null {
  const gross = Math.max(0, Math.round(Number(params.grossPlatformFeeCents) || 0));
  const discount = Math.max(0, Math.round(Number(params.referralFeeDiscountCents) || 0));
  const effectivePlatformFeeCents = Math.max(0, gross - discount);
  return effectivePlatformFeeCents > 0 ? effectivePlatformFeeCents : null;
}

/** Montos de una línea ReferralEarning para un programa sobre el fee efectivo. */
export function computeReferralEarningAmountsForProgram(params: {
  effectivePlatformFeeCents: number;
  referralProgram: ReferralProgram;
}): ReferralEarningAmounts | null {
  const effective = Math.max(0, Math.round(Number(params.effectivePlatformFeeCents) || 0));
  if (effective <= 0) return null;

  const share = REFERRAL_PROGRAM_FEE_SHARE[params.referralProgram];
  const referralAmountCents = Math.floor(effective * share);
  const platformNetCents = effective - referralAmountCents;
  return { effectivePlatformFeeCents: effective, referralAmountCents, platformNetCents };
}

export type ReferralEarningsBreakdown = {
  effectivePlatformFeeCents: number;
  byProgram: Partial<Record<ReferralProgram, ReferralEarningAmounts>>;
  totalReferralAmountCents: number;
  platformNetResidualCents: number;
};

/** Suma de comisiones por programa sobre el mismo fee efectivo (coexisten en una venta). */
export function computeReferralEarningsBreakdown(params: {
  effectivePlatformFeeCents: number;
  programs: ReferralProgram[];
}): ReferralEarningsBreakdown | null {
  const effective = Math.max(0, Math.round(Number(params.effectivePlatformFeeCents) || 0));
  if (effective <= 0 || params.programs.length === 0) return null;

  const byProgram: Partial<Record<ReferralProgram, ReferralEarningAmounts>> = {};
  let totalReferralAmountCents = 0;

  for (const program of params.programs) {
    const amounts = computeReferralEarningAmountsForProgram({
      effectivePlatformFeeCents: effective,
      referralProgram: program,
    });
    if (!amounts || amounts.referralAmountCents <= 0) continue;
    byProgram[program] = amounts;
    totalReferralAmountCents += amounts.referralAmountCents;
  }

  if (totalReferralAmountCents <= 0) return null;

  return {
    effectivePlatformFeeCents: effective,
    byProgram,
    totalReferralAmountCents,
    platformNetResidualCents: Math.max(0, effective - totalReferralAmountCents),
  };
}

/**
 * Calcula montos de ReferralEarning sobre el fee REAL atribuible a plataforma
 * (fee bruto teórico − descuento por saldo referido del vendedor).
 * Por defecto PHOTOGRAPHER_REFERRAL (50%).
 */
export function computeReferralEarningAmounts(params: {
  grossPlatformFeeCents: number;
  referralFeeDiscountCents?: number | null;
  referralProgram?: ReferralProgram;
}): ReferralEarningAmounts | null {
  const effective = computeEffectivePlatformFeeCents(params);
  if (effective == null) return null;
  return computeReferralEarningAmountsForProgram({
    effectivePlatformFeeCents: effective,
    referralProgram: params.referralProgram ?? ReferralProgram.PHOTOGRAPHER_REFERRAL,
  });
}

export async function persistReferralFeeDiscountCents(params: {
  orderType: "ALBUM_ORDER" | "PRINT_ORDER";
  orderId: number;
  discountCents: number;
}): Promise<void> {
  if (params.discountCents <= 0) return;
  if (params.orderType === "ALBUM_ORDER") {
    await prisma.order.update({
      where: { id: params.orderId },
      data: { referralFeeDiscountCents: params.discountCents },
    });
    return;
  }
  await prisma.printOrder.update({
    where: { id: params.orderId },
    data: { referralFeeDiscountCents: params.discountCents },
  });
}

/** Descuento referido del vendedor + persistencia opcional en el pedido antes de crear preferencia MP. */
export async function applyAndPersistSellerReferralDiscount(params: {
  sellerUserId: number | null | undefined;
  marketplaceFeeCents: number;
  persist?: { orderType: "ALBUM_ORDER" | "PRINT_ORDER"; orderId: number };
}): Promise<ReferralDiscountResult> {
  const result = await applySellerReferralDiscountToMarketplaceFee({
    sellerUserId: params.sellerUserId,
    marketplaceFeeCents: params.marketplaceFeeCents,
  });
  if (params.persist && result.discountCents > 0) {
    await persistReferralFeeDiscountCents({
      ...params.persist,
      discountCents: result.discountCents,
    });
  }
  return result;
}
