import { prisma } from "@repo/db";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
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
            priceAmount: ticket.priceAmount,
            currency: ticket.currency,
            holdMinutes: ticket.holdMinutes,
            isSoldOut: ticket.isSoldOut,
            salesStatus: ticket.salesStatus,
          };
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
