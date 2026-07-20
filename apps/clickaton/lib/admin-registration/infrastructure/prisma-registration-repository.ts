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
  TransitionPersistInput,
} from "../domain/repository";
import type {
  AdminRegistrationDetail,
  AdminRegistrationListItem,
} from "../domain/types";

const itemSelect = {
  id: true,
  productId: true,
  productVariantId: true,
  nameSnapshot: true,
  skuSnapshot: true,
  quantity: true,
  unitPriceAmount: true,
  totalPriceAmount: true,
  currency: true,
  isIncluded: true,
} as const;

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
  _count: { items: number; audits: number };
}): AdminRegistrationListItem {
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
    paymentOrderId: row.paymentOrderId,
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasInternalNotes: row._count.audits > 0,
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
    },
  });
  if (!row) return null;

  const hasInternalNotes = row.audits.some((a) => a.action === "INTERNAL_NOTE");

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
    paymentOrderId: row.paymentOrderId,
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasInternalNotes,
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
  };
}
