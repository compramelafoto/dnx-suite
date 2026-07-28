import { prisma, Prisma } from "@/lib/admin/db";
import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import { AdminRegistrationNotFoundError } from "../domain/errors";
import type {
  AssignmentPersistInput,
  ClickatonAdminRegistrationRepository,
  InternalNotePersistInput,
  ItemFulfillmentPersistInput,
  TransitionPersistInput,
} from "../domain/repository";
import type {
  AdminRegistrationDetail,
  AdminRegistrationListItem,
} from "../domain/types";

const itemSelect = {
  id: true,
  ticketTypeItemId: true,
  productId: true,
  productVariantId: true,
  nameSnapshot: true,
  variantNameSnapshot: true,
  skuSnapshot: true,
  quantity: true,
  unitPriceAmount: true,
  totalPriceAmount: true,
  currency: true,
  isIncluded: true,
  fulfillmentStatus: true,
  fulfilledAt: true,
  fulfilledByUserId: true,
} as const;

function primaryIncludedItem(
  items: Array<{
    nameSnapshot: string;
    variantNameSnapshot: string | null;
    fulfillmentStatus: import("@/lib/registration/domain/types").ClickatonItemFulfillmentStatus;
    isIncluded: boolean;
  }>,
) {
  return items.find((i) => i.isIncluded) ?? items[0] ?? null;
}

function mapList(row: {
  id: string;
  editionId: string;
  venueId: string | null;
  ticketTypeId: string;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  visibleCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string | null;
  currency: string;
  totalAmount: number;
  paymentOrderId: string | null;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fotoRankParticipantId: string | null;
  fotoRankSyncStatus: string | null;
  fotoRankSyncedAt: Date | null;
  instagramHandle: string | null;
  profilePhotoAssetId: string | null;
  welcomeCardId: string | null;
  welcomeCardStatus: string | null;
  welcomeCardAssetId: string | null;
  welcomePublicationStatus: string | null;
  _count: { items: number; audits: number };
  items?: Array<{
    nameSnapshot: string;
    variantNameSnapshot: string | null;
    fulfillmentStatus: import("@/lib/registration/domain/types").ClickatonItemFulfillmentStatus;
    isIncluded: boolean;
  }>;
}): AdminRegistrationListItem {
  const primary = primaryIncludedItem(row.items ?? []);
  return {
    id: row.id,
    editionId: row.editionId,
    venueId: row.venueId,
    ticketTypeId: row.ticketTypeId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    visibleCode: row.visibleCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    documentNumber: row.documentNumber,
    currency: row.currency,
    totalAmount: row.totalAmount,
    itemCount: row._count.items,
    includedProductLabel: primary?.nameSnapshot ?? null,
    shirtSizeLabel: primary?.variantNameSnapshot ?? null,
    itemFulfillmentStatus: primary?.fulfillmentStatus ?? null,
    paymentOrderId: row.paymentOrderId,
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasInternalNotes: row._count.audits > 0,
    fotoRankParticipantId: row.fotoRankParticipantId,
    fotoRankSyncStatus: row.fotoRankSyncStatus,
    fotoRankSyncedAt: row.fotoRankSyncedAt,
    instagramHandle: row.instagramHandle,
    profilePhotoAssetId: row.profilePhotoAssetId,
    welcomeCardId: row.welcomeCardId,
    welcomeCardStatus: row.welcomeCardStatus,
    welcomeCardAssetId: row.welcomeCardAssetId,
    welcomePublicationStatus: row.welcomePublicationStatus,
  };
}

async function loadDetail(id: string): Promise<AdminRegistrationDetail | null> {
  const row = await prisma.clickatonRegistration.findUnique({
    where: { id },
    include: {
      items: { select: itemSelect },
      capacityHold: true,
      stockHolds: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
      fotoRankSyncs: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          attemptCount: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          fotoRankContestId: true,
          completedAt: true,
          updatedAt: true,
        },
      },
      welcomeCards: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          templateId: true,
          templateVersion: true,
          pngAssetId: true,
          webpAssetId: true,
          publicationStatus: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          attemptCount: true,
          generatedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const hasInternalNotes = row.audits.some((a) => a.action === "INTERNAL_NOTE");
  const latestSync = row.fotoRankSyncs[0] ?? null;
  const latestCard = row.welcomeCards[0] ?? null;
  const assetIds = [latestCard?.pngAssetId, latestCard?.webpAssetId].filter(
    (v): v is string => Boolean(v),
  );
  const assets = assetIds.length
    ? await prisma.dnxMediaAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, publicUrl: true },
      })
    : [];
  const assetUrl = new Map(assets.map((a) => [a.id, a.publicUrl]));

  return {
    id: row.id,
    editionId: row.editionId,
    venueId: row.venueId,
    ticketTypeId: row.ticketTypeId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    visibleCode: row.visibleCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    documentNumber: row.documentNumber,
    currency: row.currency,
    totalAmount: row.totalAmount,
    itemCount: row.items.length,
    includedProductLabel: primaryIncludedItem(row.items)?.nameSnapshot ?? null,
    shirtSizeLabel: primaryIncludedItem(row.items)?.variantNameSnapshot ?? null,
    itemFulfillmentStatus: primaryIncludedItem(row.items)?.fulfillmentStatus ?? null,
    paymentOrderId: row.paymentOrderId,
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasInternalNotes,
    fotoRankParticipantId: row.fotoRankParticipantId,
    fotoRankSyncStatus: row.fotoRankSyncStatus,
    fotoRankSyncedAt: row.fotoRankSyncedAt,
    instagramHandle: row.instagramHandle,
    profilePhotoAssetId: row.profilePhotoAssetId,
    welcomeCardId: row.welcomeCardId,
    welcomeCardStatus: row.welcomeCardStatus,
    welcomeCardAssetId: row.welcomeCardAssetId,
    welcomePublicationStatus: row.welcomePublicationStatus,
    userId: row.userId,
    phone: row.phone,
    city: row.city,
    province: row.province,
    country: row.country,
    birthDate: row.birthDate,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    refundedAt: row.refundedAt,
    paymentProvider: row.paymentProvider,
    paymentExternalReference: row.paymentExternalReference,
    paymentIdempotencyKey: row.paymentIdempotencyKey,
    items: row.items.map((i) => ({
      id: i.id,
      ticketTypeItemId: i.ticketTypeItemId,
      productId: i.productId,
      productVariantId: i.productVariantId,
      nameSnapshot: i.nameSnapshot,
      variantNameSnapshot: i.variantNameSnapshot,
      skuSnapshot: i.skuSnapshot,
      quantity: i.quantity,
      unitPriceAmount: i.unitPriceAmount,
      totalPriceAmount: i.totalPriceAmount,
      currency: i.currency,
      isIncluded: i.isIncluded,
      fulfillmentStatus: i.fulfillmentStatus,
      fulfilledAt: i.fulfilledAt,
      fulfilledByUserId: i.fulfilledByUserId,
    })),
    capacityHold: row.capacityHold
      ? {
          id: row.capacityHold.id,
          status: row.capacityHold.status,
          expiresAt: row.capacityHold.expiresAt,
          consumedAt: row.capacityHold.consumedAt,
          releasedAt: row.capacityHold.releasedAt,
          ticketTypeId: row.capacityHold.ticketTypeId,
        }
      : null,
    stockHolds: row.stockHolds.map((h) => ({
      id: h.id,
      productVariantId: h.productVariantId,
      quantity: h.quantity,
      status: h.status,
      expiresAt: h.expiresAt,
    })),
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      previousPaymentStatus: h.previousPaymentStatus,
      newPaymentStatus: h.newPaymentStatus,
      actorUserId: h.actorUserId,
      source: h.source,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
    audits: row.audits.map((a) => ({
      id: a.id,
      action: a.action,
      source: a.source,
      actorUserId: a.actorUserId,
      metadata:
        a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata)
          ? (a.metadata as Record<string, unknown>)
          : null,
      createdAt: a.createdAt,
    })),
    fotoRankSync: latestSync
      ? {
          id: latestSync.id,
          status: latestSync.status,
          attemptCount: latestSync.attemptCount,
          lastErrorCode: latestSync.lastErrorCode,
          lastErrorMessage: latestSync.lastErrorMessage,
          fotoRankContestId: latestSync.fotoRankContestId,
          completedAt: latestSync.completedAt,
          updatedAt: latestSync.updatedAt,
        }
      : null,
    welcomeCard: latestCard
      ? {
          id: latestCard.id,
          status: latestCard.status,
          templateId: latestCard.templateId,
          templateVersion: latestCard.templateVersion,
          pngUrl: latestCard.pngAssetId
            ? assetUrl.get(latestCard.pngAssetId) ?? null
            : null,
          webpUrl: latestCard.webpAssetId
            ? assetUrl.get(latestCard.webpAssetId) ?? null
            : null,
          publicationStatus: latestCard.publicationStatus,
          lastErrorCode: latestCard.lastErrorCode,
          lastErrorMessage: latestCard.lastErrorMessage,
          attemptCount: latestCard.attemptCount,
          generatedAt: latestCard.generatedAt,
        }
      : null,
    commercial: {
      kind: "registration_with_soft_payment_refs",
      paymentOrderId: row.paymentOrderId,
      paymentProvider: row.paymentProvider,
      paymentExternalReference: row.paymentExternalReference,
      paymentStatus: row.paymentStatus,
      totalAmount: row.totalAmount,
      currency: row.currency,
    },
  };
}

export function createPrismaAdminRegistrationRepository(): ClickatonAdminRegistrationRepository {
  return {
    async list(filters) {
      const where: Prisma.ClickatonRegistrationWhereInput = {};
      if (filters.editionId) where.editionId = filters.editionId;
      if (filters.venueId !== undefined) {
        where.venueId = filters.venueId;
      }
      if (filters.ticketTypeId) where.ticketTypeId = filters.ticketTypeId;
      if (filters.status) where.status = filters.status;
      if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
      if (filters.hasPaymentOrder === true) where.paymentOrderId = { not: null };
      if (filters.hasPaymentOrder === false) where.paymentOrderId = null;
      if (filters.createdFrom || filters.createdTo) {
        where.createdAt = {};
        if (filters.createdFrom) where.createdAt.gte = filters.createdFrom;
        if (filters.createdTo) where.createdAt.lte = filters.createdTo;
      }
      if (filters.query) {
        const q = filters.query.trim();
        where.OR = [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { visibleCode: { contains: q, mode: "insensitive" } },
        ];
      }
      if (filters.hasInternalNotes === true) {
        where.audits = { some: { action: "INTERNAL_NOTE" } };
      }
      if (filters.hasInternalNotes === false) {
        where.audits = { none: { action: "INTERNAL_NOTE" } };
      }
      if (filters.shirtSize) {
        const size = filters.shirtSize.trim();
        where.items = {
          some: {
            isIncluded: true,
            OR: [
              { variantNameSnapshot: { equals: size, mode: "insensitive" } },
              { productVariant: { code: { equals: size, mode: "insensitive" } } },
            ],
          },
        };
      }
      if (filters.fulfillmentStatus) {
        where.items = {
          ...(where.items && typeof where.items === "object" ? where.items : {}),
          some: {
            ...((where.items as { some?: object } | undefined)?.some ?? {}),
            isIncluded: true,
            fulfillmentStatus: filters.fulfillmentStatus,
          },
        };
      }

      const rows = await prisma.clickatonRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          editionId: true,
          venueId: true,
          ticketTypeId: true,
          status: true,
          paymentStatus: true,
          visibleCode: true,
          firstName: true,
          lastName: true,
          email: true,
          documentNumber: true,
          currency: true,
          totalAmount: true,
          paymentOrderId: true,
          holdExpiresAt: true,
          confirmedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          fotoRankParticipantId: true,
          fotoRankSyncStatus: true,
          fotoRankSyncedAt: true,
          instagramHandle: true,
          profilePhotoAssetId: true,
          welcomeCardId: true,
          welcomeCardStatus: true,
          welcomeCardAssetId: true,
          welcomePublicationStatus: true,
          items: {
            where: { isIncluded: true },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: {
              nameSnapshot: true,
              variantNameSnapshot: true,
              fulfillmentStatus: true,
              isIncluded: true,
            },
          },
          _count: {
            select: {
              items: true,
              audits: { where: { action: "INTERNAL_NOTE" } },
            },
          },
        },
      });
      return rows.map(mapList);
    },

    async getById(id) {
      return loadDetail(id);
    },

    async getTicketType(ticketTypeId) {
      const row = await prisma.clickatonTicketType.findUnique({
        where: { id: ticketTypeId },
        select: {
          id: true,
          editionId: true,
          venueId: true,
          capacity: true,
          isActive: true,
        },
      });
      return row;
    },

    async getVenue(venueId) {
      const row = await prisma.clickatonVenue.findUnique({
        where: { id: venueId },
        select: { id: true, editionId: true, isActive: true },
      });
      return row;
    },

    async countConfirmedAndActiveHolds(ticketTypeId) {
      const now = new Date();
      const [confirmed, activeHolds] = await Promise.all([
        prisma.clickatonRegistration.count({
          where: { ticketTypeId, status: "CONFIRMED" },
        }),
        prisma.clickatonCapacityHold.count({
          where: {
            ticketTypeId,
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
        }),
      ]);
      return { confirmed, activeHolds };
    },

    async applyTransition(input: TransitionPersistInput) {
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
      });
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);

      await prisma.$transaction(async (tx) => {
        const data: Prisma.ClickatonRegistrationUpdateInput = {
          status: input.nextStatus,
          paymentStatus: input.nextPaymentStatus,
        };
        if (input.setConfirmedAt) data.confirmedAt = new Date();
        if (input.setCancelledAt) data.cancelledAt = new Date();
        if (input.clearCancelledAt) data.cancelledAt = null;

        await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data,
        });

        if (input.holdMode === "consume") {
          await tx.clickatonCapacityHold.updateMany({
            where: { registrationId: input.registrationId, status: "ACTIVE" },
            data: { status: "CONSUMED", consumedAt: new Date() },
          });
          await tx.clickatonStockHold.updateMany({
            where: { registrationId: input.registrationId, status: "ACTIVE" },
            data: { status: "CONSUMED", consumedAt: new Date() },
          });
        }
        if (input.holdMode === "release") {
          await tx.clickatonCapacityHold.updateMany({
            where: { registrationId: input.registrationId, status: "ACTIVE" },
            data: { status: "RELEASED", releasedAt: new Date() },
          });
          await tx.clickatonStockHold.updateMany({
            where: { registrationId: input.registrationId, status: "ACTIVE" },
            data: { status: "RELEASED", releasedAt: new Date() },
          });
        }

        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId: input.registrationId,
            previousStatus: input.previousStatus,
            newStatus: input.nextStatus,
            previousPaymentStatus: input.previousPaymentStatus,
            newPaymentStatus: input.nextPaymentStatus,
            actorUserId: input.actorUserId,
            source: input.source,
            reason: input.reason,
          },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            actorUserId: input.actorUserId,
            action: input.action,
            source: input.source,
            metadata: { reason: input.reason },
          },
        });
      });

      const detail = await loadDetail(input.registrationId);
      if (!detail) throw new AdminRegistrationNotFoundError(input.registrationId);
      return detail;
    },

    async updateAssignment(input: AssignmentPersistInput) {
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
      });
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);

      await prisma.$transaction(async (tx) => {
        await tx.clickatonRegistration.update({
          where: { id: input.registrationId },
          data: {
            venueId: input.venueId,
            ticketTypeId: input.ticketTypeId,
          },
        });
        await tx.clickatonCapacityHold.updateMany({
          where: { registrationId: input.registrationId },
          data: { ticketTypeId: input.ticketTypeId, venueId: input.venueId },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            actorUserId: input.actorUserId,
            action: "ASSIGNMENT_UPDATED",
            source: "admin",
            metadata: {
              reason: input.reason,
              venueId: input.venueId,
              ticketTypeId: input.ticketTypeId,
            },
          },
        });
      });

      const detail = await loadDetail(input.registrationId);
      if (!detail) throw new AdminRegistrationNotFoundError(input.registrationId);
      return detail;
    },

    async addInternalNote(input: InternalNotePersistInput) {
      const existing = await prisma.clickatonRegistration.findUnique({
        where: { id: input.registrationId },
      });
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);
      await prisma.clickatonRegistrationAudit.create({
        data: {
          registrationId: input.registrationId,
          actorUserId: input.actorUserId,
          action: "INTERNAL_NOTE",
          source: "admin",
          metadata: { note: input.note.trim() },
        },
      });
      const detail = await loadDetail(input.registrationId);
      if (!detail) throw new AdminRegistrationNotFoundError(input.registrationId);
      return detail;
    },

    async updateItemFulfillment(input: ItemFulfillmentPersistInput) {
      const item = await prisma.clickatonRegistrationItem.findFirst({
        where: { id: input.registrationItemId, registrationId: input.registrationId },
      });
      if (!item) throw new AdminRegistrationNotFoundError(input.registrationItemId);

      const previous = item.fulfillmentStatus;
      const now = new Date();
      const delivered = input.nextStatus === "DELIVERED";

      await prisma.$transaction(async (tx) => {
        await tx.clickatonRegistrationItem.update({
          where: { id: item.id },
          data: {
            fulfillmentStatus: input.nextStatus,
            fulfilledAt: delivered ? now : null,
            fulfilledByUserId: delivered ? input.actorUserId : null,
          },
        });
        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId: input.registrationId,
            actorUserId: input.actorUserId,
            action: "ITEM_FULFILLMENT_UPDATED",
            source: "admin",
            metadata: {
              registrationItemId: item.id,
              previousStatus: previous,
              nextStatus: input.nextStatus,
              reason: input.reason ?? null,
              variantNameSnapshot: item.variantNameSnapshot,
              nameSnapshot: item.nameSnapshot,
            },
          },
        });
      });

      const detail = await loadDetail(input.registrationId);
      if (!detail) throw new AdminRegistrationNotFoundError(input.registrationId);
      return detail;
    },
  };
}
