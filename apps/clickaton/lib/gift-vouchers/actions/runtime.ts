import { prisma } from "@repo/db";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import {
  attachPromotionRedemptionRegistration,
  reserveClickatonPromotion,
} from "@/lib/promotions/prisma-promotions-adapter";
import { createGiftRegistrationUseCase } from "../application/create-gift-registration";
import { redeemGiftVoucherUseCase } from "../application/redeem-gift-voucher";
import type { GiftVoucherRepository } from "../domain/repository";
import { createPrismaGiftVoucherRepository } from "../infrastructure/prisma-gift-voucher-repository";

type GiftVoucherRuntime = {
  vouchers: GiftVoucherRepository;
  createGift: ReturnType<typeof createGiftRegistrationUseCase>;
  redeemGift: ReturnType<typeof redeemGiftVoucherUseCase>;
};

let cached: GiftVoucherRuntime | null = null;

export function getGiftVoucherRuntime(): GiftVoucherRuntime {
  if (cached) return cached;

  const vouchers = createPrismaGiftVoucherRepository();
  const publicRepo = createPrismaPublicRegistrationRepository();

  cached = {
    vouchers,
    createGift: createGiftRegistrationUseCase({
      vouchers,
      clock: { now: () => new Date() },
      // El mismo motor de cupones que la inscripción normal: un código sirve
      // igual para regalar que para inscribirse uno mismo.
      promotions: {
        reserve: reserveClickatonPromotion,
        attachRegistration: attachPromotionRedemptionRegistration,
      },
      registrations: {
        async getEditionBySlug(slug) {
          const edition = await publicRepo.getEditionBySlug(slug);
          if (!edition) return null;
          return {
            id: edition.id,
            slug: edition.slug,
            giftVouchersEnabled: edition.giftVouchersEnabled ?? false,
            registrationOpenAt: edition.registrationOpenAt,
            registrationCloseAt: edition.registrationCloseAt,
            registrationEnabled: edition.registrationEnabled,
            isPublished: edition.isPublished,
          };
        },
        async getTicketDetail(ticketTypeId) {
          const ticket = await publicRepo.getTicketDetail(ticketTypeId);
          if (!ticket) return null;
          return {
            id: ticket.id,
            editionId: ticket.editionId,
            venueId: ticket.venueId,
            code: ticket.code,
            priceAmount: ticket.priceAmount,
            currency: ticket.currency,
            holdMinutes: ticket.holdMinutes,
            isSoldOut: ticket.isSoldOut,
            salesStatus: ticket.salesStatus,
          };
        },
        async listPricePhases(editionId) {
          const phases = await publicRepo.listPricePhases(editionId);
          return phases.map((p) => ({
            id: p.id,
            name: p.name,
            amount: p.amount,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            isActive: p.isActive,
            priority: p.priority,
            capacity: p.capacity,
            currency: p.currency,
          }));
        },
        createReservedRegistration(cmd) {
          return publicRepo.createReservedGiftRegistration(
            cmd as Parameters<typeof publicRepo.createReservedGiftRegistration>[0],
          );
        },
      },
    }),

    redeemGift: redeemGiftVoucherUseCase({
      vouchers,
      clock: { now: () => new Date() },
      registrations: {
        async getEditionById(editionId) {
          const edition = await prisma.clickatonEdition.findUnique({
            where: { id: editionId },
            select: {
              id: true,
              slug: true,
              giftVouchersEnabled: true,
              registrationCloseAt: true,
              visibleCodePrefix: true,
            },
          });
          return edition ?? null;
        },
        completeGiftRegistration(cmd) {
          return publicRepo.completeGiftRegistration(
            cmd as Parameters<typeof publicRepo.completeGiftRegistration>[0],
          );
        },
      },
    }),
  };
  return cached;
}
