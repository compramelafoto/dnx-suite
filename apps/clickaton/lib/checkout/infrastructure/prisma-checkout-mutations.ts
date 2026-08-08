import { Prisma, prisma } from "@repo/db";
import { confirmClickatonPromotionRedemption } from "@/lib/promotions/prisma-promotions-adapter";
import { linkRegistrationIdentity } from "@/lib/registration/application/link-registration-identity";
import { issueRegistrationQrToken } from "@/lib/registration/security/qr-token";
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
  userId: number | null;
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
  refundedAmountMinor?: number | null;
  providerPaymentId?: string | null;
  lastProviderRefundId?: string | null;
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
    refundedAmountMinor: row.refundedAmountMinor ?? null,
    providerPaymentId: row.providerPaymentId ?? null,
    lastProviderRefundId: row.lastProviderRefundId ?? null,
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
      // Neon + first-N locks + credential/QR: default 5s interactive timeout is too tight.
      return prisma.$transaction(
        async (tx) => {
        const existing = await tx.clickatonRegistration.findUnique({
          where: { id: input.registrationId },
          include: { items: true },
        });
        if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");
        if (existing.status === "CONFIRMED" && existing.paymentStatus === "APPROVED") {
          return mapRecord(existing);
        }
        // REFUNDED no se revive a CONFIRMED por un APPROVED tardío.
        if (
          existing.status === "REFUNDED" ||
          existing.paymentStatus === "REFUNDED" ||
          existing.paymentStatus === "PARTIALLY_REFUNDED"
        ) {
          throw new CheckoutError(
            "PAYMENT_CONFLICT",
            "No se puede confirmar una inscripción reembolsada.",
          );
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

        const confirmedAt = new Date();
        // First-N + deadline: serializa cupo CONFIRMED (locks phase items).
        const phaseItemIds = [
          ...new Set(
            existing.items
              .map((i) => i.pricePhaseItemId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        if (phaseItemIds.length > 0) {
          const { selectBenefitItemsToRevoke } = await import(
            "@/lib/catalog/domain/reconcile-first-n-on-confirm"
          );
          await tx.$queryRaw`
            SELECT id FROM "ClickatonPricePhaseItem"
            WHERE id IN (${Prisma.join(phaseItemIds)})
            FOR UPDATE
          `;
          const metas = await tx.clickatonPricePhaseItem.findMany({
            where: { id: { in: phaseItemIds } },
            select: {
              id: true,
              productId: true,
              stockLimit: true,
              benefitDeadlineAt: true,
            },
          });
          const phaseMetaById = new Map(metas.map((m) => [m.id, m]));
          const productIds = [...new Set(metas.map((m) => m.productId))];
          const confirmedByProductId = new Map<string, number>();
          for (const pid of productIds) confirmedByProductId.set(pid, 0);
          if (productIds.length > 0) {
            const confirmedCounts = await tx.clickatonRegistrationItem.groupBy({
              by: ["productId"],
              where: {
                productId: { in: productIds },
                registration: {
                  status: "CONFIRMED",
                  id: { not: input.registrationId },
                },
              },
              _count: { _all: true },
            });
            for (const row of confirmedCounts) {
              if (row.productId) {
                confirmedByProductId.set(row.productId, row._count._all);
              }
            }
          }
          const { revokeItemIds, reasonByItemId } = selectBenefitItemsToRevoke({
            items: existing.items.map((i) => ({
              id: i.id,
              pricePhaseItemId: i.pricePhaseItemId,
              productId: i.productId,
            })),
            phaseMetaById,
            confirmedByProductId,
            confirmedAt,
          });
          if (revokeItemIds.length > 0) {
            await tx.clickatonRegistrationItem.updateMany({
              where: { id: { in: revokeItemIds } },
              data: {
                isIncluded: false,
                fulfillmentStatus: "CANCELLED",
                fulfillmentNotes: "first_n_or_deadline_not_eligible_at_confirm",
              },
            });
            await tx.clickatonRegistrationAudit.create({
              data: {
                registrationId: input.registrationId,
                action: "FIRST_N_BENEFIT_REVOKED_ON_CONFIRM",
                source: input.source,
                metadata: {
                  revokeItemIds,
                  reasons: Object.fromEntries(reasonByItemId),
                },
              },
            });
          }
        }

        const remotePid = input.providerPaymentId?.trim() ?? "";
        const updated = await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            confirmedAt,
            cancelledAt: null,
            visibleCode,
            sequenceNumber,
            paymentOrderId: input.paymentOrderId,
            ...(!existing.providerPaymentId && /^\d+$/.test(remotePid)
              ? { providerPaymentId: remotePid }
              : {}),
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

        // Credential + QR once (idempotent). Never depends on browser redirect.
        let credential = await tx.clickatonParticipantCredential.findUnique({
          where: { registrationId: input.registrationId },
        });
        if (!credential) {
          const publicCode =
            visibleCode ??
            `CK-${input.registrationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}`;
          credential = await tx.clickatonParticipantCredential.create({
            data: {
              registrationId: input.registrationId,
              status: "ACTIVE",
              publicCode,
            },
          });
          await tx.clickatonRegistrationAudit.create({
            data: {
              registrationId: input.registrationId,
              action: "CREDENTIAL_ISSUED",
              source: input.source,
              metadata: {
                credentialIdPrefix: credential.id.slice(0, 10),
                publicCodePrefix: publicCode.slice(0, 8),
              },
            },
          });
        }

        const activeQr = await tx.clickatonQrToken.findFirst({
          where: { credentialId: credential.id, status: "ACTIVE", revokedAt: null },
        });
        if (!activeQr) {
          const issued = issueRegistrationQrToken({
            registrationId: input.registrationId,
            credentialId: credential.id,
          });
          await tx.clickatonQrToken.create({
            data: {
              credentialId: credential.id,
              tokenHash: issued.tokenHash,
              tokenPrefix: issued.tokenPrefix,
              status: "ACTIVE",
            },
          });
          await tx.clickatonRegistrationAudit.create({
            data: {
              registrationId: input.registrationId,
              action: "QR_TOKEN_ISSUED",
              source: input.source,
              metadata: {
                credentialIdPrefix: credential.id.slice(0, 10),
                tokenPrefix: issued.tokenPrefix,
                regenerable: true,
                // plaintext never persisted in audit
              },
            },
          });
        }

        return mapRecord(updated);
      },
        { timeout: 30_000, maxWait: 10_000 },
      ).then(async (record) => {
        try {
          await confirmClickatonPromotionRedemption(input.registrationId);
        } catch {
          // best-effort: el pago ya quedó CONFIRMADO
        }
        try {
          const linked = await linkRegistrationIdentity({
            registrationId: input.registrationId,
            email: record.participant.email,
            name: `${record.participant.firstName} ${record.participant.lastName}`.trim(),
            sourceApplication: "clickaton",
          });
          try {
            const { isMarathonPackTicketCode } = await import("@/lib/packs/marathon-pack");
            const reg = await prisma.clickatonRegistration.findUnique({
              where: { id: input.registrationId },
              select: {
                editionId: true,
                totalAmount: true,
                ticketType: { select: { code: true } },
              },
            });
            if (reg && isMarathonPackTicketCode(reg.ticketType.code)) {
              const { grantAnnualPassAfterPackPurchase } = await import(
                "@/lib/packs/annual-pass-service"
              );
              await grantAnnualPassAfterPackPurchase({
                registrationId: input.registrationId,
                userId: linked.userId,
                editionId: reg.editionId,
                purchasePriceMinor: reg.totalAmount,
              });
            }
          } catch (passErr) {
            console.error(
              "[clickaton] grantAnnualPassAfterPackPurchase failed:",
              passErr,
            );
          }
          return { ...record, userId: linked.userId };
        } catch {
          // best-effort: confirmación de pago no debe revertirse por identidad
          return record;
        }
      });
    },

    async syncProviderPaymentId(input) {
      const { decideProviderPaymentIdSync } = await import(
        "@/lib/checkout/domain/sync-provider-payment-id"
      );
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
        select: {
          id: true,
          status: true,
          providerPaymentId: true,
          paymentStatus: true,
        },
      });
      if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");

      const decision = decideProviderPaymentIdSync({
        localProviderPaymentId: existing.providerPaymentId,
        remoteProviderPaymentId: input.providerPaymentId,
      });

      if (decision.action === "noop") {
        return {
          outcome: "noop" as const,
          providerPaymentId: existing.providerPaymentId ?? null,
          paymentStatus: existing.paymentStatus,
        };
      }

      if (decision.action === "manual_review") {
        const reviewed = await prisma.$transaction(async (tx) => {
          const updated = await tx.clickatonRegistration.update({
            where: { id: input.registrationId },
            data: { paymentStatus: "MANUAL_REVIEW" },
            select: { providerPaymentId: true, paymentStatus: true, status: true },
          });
          await tx.clickatonRegistrationStatusHistory.create({
            data: {
              registrationId: input.registrationId,
              previousStatus: existing.status,
              newStatus: updated.status,
              previousPaymentStatus: existing.paymentStatus,
              newPaymentStatus: updated.paymentStatus,
              source: input.source,
              reason: "provider_payment_id_conflict",
            },
          });
          await tx.clickatonRegistrationAudit.create({
            data: {
              registrationId: input.registrationId,
              action: "PAYMENT_STATUS_UPDATED",
              source: input.source,
              metadata: {
                reason: "provider_payment_id_conflict",
                requestId: input.requestId,
                localProviderPaymentId: decision.local,
                remoteProviderPaymentId: decision.remote,
              },
            },
          });
          return updated;
        });
        return {
          outcome: "manual_review" as const,
          providerPaymentId: reviewed.providerPaymentId ?? null,
          paymentStatus: reviewed.paymentStatus,
        };
      }

      // Solo escribe si sigue null (carrera: otro proceso pudo setearlo).
      const updated = await prisma.clickatonRegistration.updateMany({
        where: {
          id: input.registrationId,
          providerPaymentId: null,
        },
        data: { providerPaymentId: decision.providerPaymentId },
      });
      if (updated.count === 0) {
        const again = await prisma.clickatonRegistration.findUnique({
          where: { id: input.registrationId },
          select: { providerPaymentId: true, paymentStatus: true },
        });
        if (again?.providerPaymentId === decision.providerPaymentId) {
          return {
            outcome: "noop" as const,
            providerPaymentId: again.providerPaymentId,
            paymentStatus: again.paymentStatus,
          };
        }
        if (again?.providerPaymentId && again.providerPaymentId !== decision.providerPaymentId) {
          return {
            outcome: "manual_review" as const,
            providerPaymentId: again.providerPaymentId,
            paymentStatus: "MANUAL_REVIEW",
          };
        }
        return {
          outcome: "noop" as const,
          providerPaymentId: again?.providerPaymentId ?? null,
          paymentStatus: again?.paymentStatus ?? existing.paymentStatus,
        };
      }
      await prisma.clickatonRegistrationAudit.create({
        data: {
          registrationId: input.registrationId,
          action: "PROVIDER_PAYMENT_ID_BACKFILL",
          source: input.source,
          metadata: {
            requestId: input.requestId,
            providerPaymentId: decision.providerPaymentId,
          },
        },
      });
      return {
        outcome: "persisted" as const,
        providerPaymentId: decision.providerPaymentId,
        paymentStatus: existing.paymentStatus,
      };
    },

    async markPaymentStatus(input) {
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
      });
      if (!existing) throw new CheckoutError("NOT_FOUND", "Inscripción no encontrada.");

      // Idempotencia: mismo estado + mismo importe reembolsado → no-op efectivo.
      const sameRefundAmount =
        typeof input.refundedAmountMinor === "number"
          ? (existing.refundedAmountMinor ?? null) === input.refundedAmountMinor
          : true;
      if (
        existing.paymentStatus === input.paymentStatus &&
        (!input.registrationStatus || existing.status === input.registrationStatus) &&
        sameRefundAmount &&
        (input.paymentStatus === "REFUNDED" || input.paymentStatus === "PARTIALLY_REFUNDED")
      ) {
        return mapRecord({ ...existing, items: [] });
      }

      const row = await prisma.$transaction(async (tx) => {
        const isRefund =
          input.paymentStatus === "REFUNDED" || input.paymentStatus === "PARTIALLY_REFUNDED";
        const updated = await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            paymentStatus: input.paymentStatus,
            ...(input.registrationStatus ? { status: input.registrationStatus } : {}),
            ...(input.registrationStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
            ...(input.registrationStatus === "REFUNDED"
              ? { refundedAt: existing.refundedAt ?? new Date() }
              : {}),
            ...(isRefund && typeof input.refundedAmountMinor === "number"
              ? { refundedAmountMinor: input.refundedAmountMinor }
              : {}),
            ...(input.providerPaymentId
              ? { providerPaymentId: input.providerPaymentId }
              : {}),
            ...(input.lastProviderRefundId
              ? { lastProviderRefundId: input.lastProviderRefundId }
              : {}),
          },
          include: { items: true },
        });

        // Revocación blanda de credencial ante reembolso total (idempotente).
        if (input.registrationStatus === "REFUNDED") {
          await tx.clickatonParticipantCredential.updateMany({
            where: {
              registrationId: input.registrationId,
              status: "ACTIVE",
            },
            data: {
              status: "REVOKED",
              revokedAt: new Date(),
            },
          });
          await tx.clickatonQrToken.updateMany({
            where: {
              credential: { registrationId: input.registrationId },
              status: "ACTIVE",
            },
            data: { status: "REVOKED", revokedAt: new Date() },
          });
        }

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
            action: isRefund ? "PAYMENT_REFUND_APPLIED" : "PAYMENT_STATUS_UPDATED",
            source: input.source,
            metadata: {
              reason: input.reason,
              requestId: input.requestId,
              previousPaymentStatus: existing.paymentStatus,
              newPaymentStatus: updated.paymentStatus,
              previousRegistrationStatus: existing.status,
              newRegistrationStatus: updated.status,
              refundedAmountMinor: input.refundedAmountMinor ?? null,
              providerPaymentId: input.providerPaymentId ?? null,
              lastProviderRefundId: input.lastProviderRefundId ?? null,
              idempotencyKey: `${input.registrationId}:${input.paymentStatus}:${input.refundedAmountMinor ?? 0}`,
            },
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
