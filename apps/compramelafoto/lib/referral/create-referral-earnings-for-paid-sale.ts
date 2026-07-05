import { ReferralProgram } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  computeEffectivePlatformFeeCents,
  computeReferralEarningAmountsForProgram,
  type ReferralEarningAmounts,
} from "@/lib/referral/referral-marketplace-fee";
import { shouldSkipReferralEarningForEventOrganizer } from "@/lib/referral/skip-referral-event-organizer-double-benefit";

const LOG_PREFIX = "[referral-earnings]";

export type ReferralPaidSaleOrderType = "ALBUM_ORDER" | "PRINT_ORDER";

export type CreateReferralEarningsForPaidSaleInput = {
  saleRef: string;
  orderType: ReferralPaidSaleOrderType;
  orderId: number;
  paymentId: string;
  photographerUserId?: number | null;
  /** eventId del álbum/pedido; si null/undefined no se evalúa ORGANIZER_REFERRAL. */
  eventId?: number | null;
  grossPlatformFeeCents: number;
  referralFeeDiscountCents?: number | null;
};

export type CreateReferralEarningsForPaidSaleResult = {
  created: Array<{
    referralProgram: ReferralProgram;
    attributionId: number;
    referralAmountCents: number;
  }>;
  skipped: Array<{ referralProgram: ReferralProgram; reason: string }>;
};

type ActiveAttribution = {
  id: number;
  referrerUserId: number;
  referralProgram: ReferralProgram;
  referrerUser: {
    mpUserId: string | null;
    mpConnectedAt: Date | null;
  };
};

export async function resolveOrganizerUserIdFromEventId(
  eventId: number | null | undefined
): Promise<number | null> {
  if (eventId == null || !Number.isInteger(eventId) || eventId <= 0) {
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { creatorId: true },
  });

  return event?.creatorId ?? null;
}

async function findActiveReferralAttribution(params: {
  referredUserId: number;
  referralProgram: ReferralProgram;
}): Promise<ActiveAttribution | null> {
  return prisma.referralAttribution.findFirst({
    where: {
      referredUserId: params.referredUserId,
      referralProgram: params.referralProgram,
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    select: {
      id: true,
      referrerUserId: true,
      referralProgram: true,
      referrerUser: {
        select: { mpUserId: true, mpConnectedAt: true },
      },
    },
  });
}

function referrerHasMp(attribution: ActiveAttribution): boolean {
  return !!(
    attribution.referrerUser.mpUserId || attribution.referrerUser.mpConnectedAt
  );
}

export function planReferralEarningAmounts(params: {
  effectivePlatformFeeCents: number;
  referralProgram: ReferralProgram;
}): ReferralEarningAmounts | null {
  return computeReferralEarningAmountsForProgram(params);
}

async function createReferralEarningIfMissing(params: {
  saleRef: string;
  paymentId: string;
  attribution: ActiveAttribution;
  amounts: ReferralEarningAmounts;
}): Promise<"created" | "exists"> {
  const existing = await prisma.referralEarning.findFirst({
    where: {
      saleRef: params.saleRef,
      attributionId: params.attribution.id,
    },
    select: { id: true },
  });

  if (existing) {
    return "exists";
  }

  await prisma.referralEarning.create({
    data: {
      attributionId: params.attribution.id,
      paymentId: params.paymentId,
      saleRef: params.saleRef,
      platformFeeCents: params.amounts.effectivePlatformFeeCents,
      referralAmountCents: params.amounts.referralAmountCents,
      platformNetCents: params.amounts.platformNetCents,
      referralProgram: params.attribution.referralProgram,
    },
  });

  return "created";
}

/**
 * Crea ReferralEarning(s) para una venta pagada. Idempotente por (saleRef, attributionId).
 * No lanza: errores se registran y no bloquean el cierre del pago.
 */
export async function createReferralEarningsForPaidSale(
  input: CreateReferralEarningsForPaidSaleInput
): Promise<CreateReferralEarningsForPaidSaleResult> {
  const result: CreateReferralEarningsForPaidSaleResult = {
    created: [],
    skipped: [],
  };

  try {
    const effectivePlatformFeeCents = computeEffectivePlatformFeeCents({
      grossPlatformFeeCents: input.grossPlatformFeeCents,
      referralFeeDiscountCents: input.referralFeeDiscountCents,
    });

    if (effectivePlatformFeeCents == null) {
      result.skipped.push({
        referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
        reason: "effective_platform_fee_zero",
      });
      return result;
    }

    const photographerId = input.photographerUserId;
    if (photographerId != null) {
      try {
        const attribution = await findActiveReferralAttribution({
          referredUserId: photographerId,
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
        });

        if (!attribution) {
          result.skipped.push({
            referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
            reason: "no_active_attribution",
          });
        } else if (!referrerHasMp(attribution)) {
          result.skipped.push({
            referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
            reason: "referrer_without_mp",
          });
        } else {
          const skipReferral = await shouldSkipReferralEarningForEventOrganizer({
            referrerUserId: attribution.referrerUserId,
            albumEventId: input.eventId,
            context: {
              orderId: input.orderId,
              orderType: input.orderType,
              saleRef: input.saleRef,
            },
          });

          if (skipReferral) {
            result.skipped.push({
              referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
              reason: "event_organizer_double_benefit",
            });
          } else {
            const amounts = planReferralEarningAmounts({
              effectivePlatformFeeCents,
              referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
            });

            if (!amounts) {
              result.skipped.push({
                referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
                reason: "amounts_zero",
              });
            } else {
              const status = await createReferralEarningIfMissing({
                saleRef: input.saleRef,
                paymentId: input.paymentId,
                attribution,
                amounts,
              });

              if (status === "created") {
                console.log(LOG_PREFIX, "created", {
                  saleRef: input.saleRef,
                  orderType: input.orderType,
                  orderId: input.orderId,
                  referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
                  attributionId: attribution.id,
                  referralAmountCents: amounts.referralAmountCents,
                });
                result.created.push({
                  referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
                  attributionId: attribution.id,
                  referralAmountCents: amounts.referralAmountCents,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(LOG_PREFIX, "photographer_referral_failed", {
          saleRef: input.saleRef,
          orderId: input.orderId,
          err,
        });
        result.skipped.push({
          referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
          reason: "error",
        });
      }
    }

    const organizerUserId = await resolveOrganizerUserIdFromEventId(input.eventId);
    if (organizerUserId == null) {
      result.skipped.push({
        referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
        reason: "no_event_organizer",
      });
    } else {
      try {
        const attribution = await findActiveReferralAttribution({
          referredUserId: organizerUserId,
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
        });

        if (!attribution) {
          result.skipped.push({
            referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
            reason: "no_active_attribution",
          });
        } else if (!referrerHasMp(attribution)) {
          result.skipped.push({
            referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
            reason: "referrer_without_mp",
          });
        } else {
          const amounts = planReferralEarningAmounts({
            effectivePlatformFeeCents,
            referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
          });

          if (!amounts) {
            result.skipped.push({
              referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
              reason: "amounts_zero",
            });
          } else {
            const status = await createReferralEarningIfMissing({
              saleRef: input.saleRef,
              paymentId: input.paymentId,
              attribution,
              amounts,
            });

            if (status === "created") {
              console.log(LOG_PREFIX, "created", {
                saleRef: input.saleRef,
                orderType: input.orderType,
                orderId: input.orderId,
                referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
                attributionId: attribution.id,
                organizerUserId,
                referralAmountCents: amounts.referralAmountCents,
              });
              result.created.push({
                referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
                attributionId: attribution.id,
                referralAmountCents: amounts.referralAmountCents,
              });
            }
          }
        }
      } catch (err) {
        console.warn(LOG_PREFIX, "organizer_referral_failed", {
          saleRef: input.saleRef,
          orderId: input.orderId,
          err,
        });
        result.skipped.push({
          referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
          reason: "error",
        });
      }
    }
  } catch (err) {
    console.warn(LOG_PREFIX, "create_failed", {
      saleRef: input.saleRef,
      orderId: input.orderId,
      err,
    });
  }

  return result;
}
