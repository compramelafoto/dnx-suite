import { prisma } from "@repo/db";
import type { CheckoutRegistrationMutations } from "../domain/checkout-registration-port";
import { CheckoutError } from "../domain/errors";

function formatVisibleCode(prefix: string, seq: number, width = 5): string {
  const safe = prefix.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 8) || "CK";
  return `${safe}-${String(seq).padStart(width, "0")}`;
}

function mapRecord(row: {
  id: string;
  editionId: string;
  venueId: string | null;
  userId: number;
  ticketTypeId: string;
  status: string;
  paymentStatus: string;
  visibleCode: string | null;
  sequenceNumber: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentNumber: string | null;
  city: string | null;
  province: string | null;
  country: string;
  birthDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  acceptedTermsAt: Date | null;
  acceptedImageAt: Date | null;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  paymentOrderId: string | null;
  paymentProvider: string | null;
  paymentExternalReference: string | null;
  paymentIdempotencyKey: string | null;
  items?: Array<{
    id: string;
    productId: string | null;
    productVariantId: string | null;
    nameSnapshot: string;
    skuSnapshot: string | null;
    quantity: number;
    unitPriceAmount: number;
    totalPriceAmount: number;
    currency: string;
    isIncluded: boolean;
  }>;
}) {
  return {
    id: row.id,
    editionId: row.editionId,
    venueId: row.venueId,
    userId: row.userId,
    ticketTypeId: row.ticketTypeId,
    status: row.status as import("@/lib/registration/domain/types").ClickatonRegistrationStatus,
    paymentStatus: row.paymentStatus as import("@/lib/registration/domain/types").ClickatonPaymentStatus,
    visibleCode: row.visibleCode,
    sequenceNumber: row.sequenceNumber,
    participant: {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      documentNumber: row.documentNumber,
      city: row.city,
      province: row.province,
      country: row.country,
      birthDate: row.birthDate,
      emergencyContactName: row.emergencyContactName,
      emergencyContactPhone: row.emergencyContactPhone,
      acceptedTermsAt: row.acceptedTermsAt,
      acceptedImageAt: row.acceptedImageAt,
    },
    money: {
      currency: row.currency,
      subtotalAmount: row.subtotalAmount,
      discountAmount: row.discountAmount,
      totalAmount: row.totalAmount,
    },
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    refundedAt: row.refundedAt,
    items: (row.items ?? []).map((i) => ({
      id: i.id,
      productId: i.productId,
      productVariantId: i.productVariantId,
      nameSnapshot: i.nameSnapshot,
      skuSnapshot: i.skuSnapshot,
      quantity: i.quantity,
      unitPriceAmount: i.unitPriceAmount,
      totalPriceAmount: i.totalPriceAmount,
      currency: i.currency,
      isIncluded: i.isIncluded,
    })),
    paymentOrderId: row.paymentOrderId,
    paymentProvider: row.paymentProvider,
    paymentExternalReference: row.paymentExternalReference,
    paymentIdempotencyKey: row.paymentIdempotencyKey,
  };
}

export function createPrismaCheckoutMutations(): CheckoutRegistrationMutations {
  return {
    async getEditionPrefix(editionId) {
      const ed = await prisma.clickatonEdition.findUnique({
        where: { id: editionId },
        select: { visibleCodePrefix: true },
      });
      return ed?.visibleCodePrefix?.trim() || "CK";
    },

    async attachPaymentRefs(input) {
      const row = await prisma.clickatonRegistration.update({
        where: { id: input.registrationId },
        data: {
          paymentOrderId: input.paymentOrderId,
          paymentProvider: input.paymentProvider,
          paymentExternalReference: input.paymentExternalReference,
          paymentIdempotencyKey: input.paymentIdempotencyKey,
          paymentStatus: input.paymentStatus,
          audits: {
            create: {
              action: "CHECKOUT_ORDER_ATTACHED",
              source: "dnx_payments",
              metadata: {
                paymentOrderId: input.paymentOrderId,
                provider: input.paymentProvider,
              },
            },
          },
        },
        include: { items: true },
      });
      return mapRecord(row);
    },

    async confirmPaid(input) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.clickatonRegistration.findUnique({
          where: { id: input.registrationId },
          include: { items: true },
        });
        if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
        if (existing.status === "CONFIRMED" && existing.paymentStatus === "APPROVED") {
          return mapRecord(existing);
        }
        if (existing.paymentOrderId && existing.paymentOrderId !== input.paymentOrderId) {
          throw new CheckoutError(
            "PAYMENT_CONFLICT",
            "La orden no corresponde a esta inscripción.",
          );
        }

        let visibleCode = existing.visibleCode;
        let sequenceNumber = existing.sequenceNumber;
        if (!visibleCode) {
          const seq = await tx.clickatonEditionSequence.upsert({
            where: { editionId: existing.editionId },
            create: { editionId: existing.editionId, lastValue: 1 },
            update: { lastValue: { increment: 1 } },
          });
          sequenceNumber = seq.lastValue;
          visibleCode = formatVisibleCode(input.editionPrefix, sequenceNumber);
        }

        const updated = await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            confirmedAt: new Date(),
            visibleCode,
            sequenceNumber,
            paymentOrderId: input.paymentOrderId,
          },
          include: { items: true },
        });

        await tx.clickatonCapacityHold.updateMany({
          where: { registrationId: input.registrationId, status: "ACTIVE" },
          data: { status: "CONSUMED", consumedAt: new Date() },
        });
        await tx.clickatonStockHold.updateMany({
          where: { registrationId: input.registrationId, status: "ACTIVE" },
          data: { status: "CONSUMED", consumedAt: new Date() },
        });

        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId: input.registrationId,
            previousStatus: existing.status,
            newStatus: "CONFIRMED",
            previousPaymentStatus: existing.paymentStatus,
            newPaymentStatus: "APPROVED",
            source: input.source,
            reason: "payment_approved",
          },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            action: "PAYMENT_APPROVED_CONFIRMED",
            source: input.source,
            metadata: { paymentOrderId: input.paymentOrderId, requestId: input.requestId },
          },
        });

        return mapRecord(updated);
      });
    },

    async markPaymentStatus(input) {
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
      });
      if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");

      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            paymentStatus: input.paymentStatus,
            ...(input.registrationStatus ? { status: input.registrationStatus } : {}),
            ...(input.registrationStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
            ...(input.registrationStatus === "REFUNDED" ? { refundedAt: new Date() } : {}),
          },
          include: { items: true },
        });
        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId: input.registrationId,
            previousStatus: existing.status,
            newStatus: updated.status,
            previousPaymentStatus: existing.paymentStatus,
            newPaymentStatus: updated.paymentStatus,
            source: input.source,
            reason: input.reason,
          },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            action: "PAYMENT_STATUS_UPDATED",
            source: input.source,
            metadata: { reason: input.reason, requestId: input.requestId },
          },
        });
        return updated;
      });
      return mapRecord(row);
    },

    async releaseForPaymentTerminal(input) {
      return prisma.$transaction(async (tx) => {
        const row = await tx.clickatonRegistration.findUnique({
          where: { id: input.registrationId },
          include: { capacityHold: true, stockHolds: true, items: true },
        });
        if (!row) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
        if (row.status === "CONFIRMED" && row.paymentStatus === "APPROVED") {
          throw new CheckoutError(
            "PAYMENT_CONFLICT",
            "No se puede liberar una inscripción ya confirmada.",
          );
        }
        if (
          row.status === "CANCELLED" &&
          (row.paymentStatus === "EXPIRED" || row.paymentStatus === "CANCELLED")
        ) {
          return mapRecord(row);
        }

        if (row.capacityHold?.status === "ACTIVE") {
          await tx.clickatonCapacityHold.update({
            where: { id: row.capacityHold.id },
            data: { status: "EXPIRED", releasedAt: input.now },
          });
        }
        for (const hold of row.stockHolds) {
          if (hold.status !== "ACTIVE") continue;
          await tx.clickatonStockHold.update({
            where: { id: hold.id },
            data: { status: "EXPIRED", releasedAt: input.now },
          });
          await tx.clickatonProductVariant.update({
            where: { id: hold.productVariantId },
            data: { reservedStock: { decrement: hold.quantity } },
          });
        }

        const updated = await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            status: "CANCELLED",
            paymentStatus: input.paymentStatus,
            cancelledAt: input.now,
          },
          include: { items: true },
        });

        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId: input.registrationId,
            previousStatus: row.status,
            newStatus: "CANCELLED",
            previousPaymentStatus: row.paymentStatus,
            newPaymentStatus: input.paymentStatus,
            source: input.source,
            reason: "payment_terminal",
          },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            action: "PAYMENT_TERMINAL_RELEASE",
            source: input.source,
            metadata: { requestId: input.requestId, paymentStatus: input.paymentStatus },
          },
        });

        return mapRecord(updated);
      });
    },
  };
}
