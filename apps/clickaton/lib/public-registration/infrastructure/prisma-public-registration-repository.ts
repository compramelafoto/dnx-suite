import { Prisma, prisma } from "@/lib/admin/db";
import { buildAvailability } from "@/lib/admin-catalog/domain/availability";
import type { ClickatonRegistrationRecord } from "@/lib/registration/domain/types";
import { countsAsActiveRegistration, EXPIRATION_TARGET, isExpireCandidate } from "../domain/expiration-rules";
import { PublicRegistrationError } from "../domain/errors";
import {
  displayPublicFirstName,
  maskDocument,
  maskEmail,
  maskPhone,
  normalizeDocument,
} from "../domain/pii";
import type {
  PublicCatalogEdition,
  PublicCatalogTicket,
  PublicRegistrationRepository,
} from "../domain/repository";
import type { PublicTicketProductDto, PublicVenueDto } from "../domain/types";

function mapEdition(row: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isPublished: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  visibleCodePrefix: string | null;
}): PublicCatalogEdition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    status: row.status,
    isPublished: row.isPublished,
    registrationOpenAt: row.registrationOpenAt,
    registrationCloseAt: row.registrationCloseAt,
    startAt: row.startAt,
    endAt: row.endAt,
    timezone: row.timezone,
    visibleCodePrefix: row.visibleCodePrefix,
  };
}

function kitKindOf(products: PublicTicketProductDto[]): PublicCatalogTicket["kitKind"] {
  if (products.length === 0) return "entry";
  if (products.length === 1) return "entry_product";
  return "kit";
}

async function countUsage(ticketTypeId: string) {
  const [confirmed, activeHolds] = await Promise.all([
    prisma.clickatonRegistration.count({
      where: { ticketTypeId, status: "CONFIRMED" },
    }),
    prisma.clickatonCapacityHold.count({
      where: {
        ticketTypeId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return { confirmed, activeHolds };
}

async function mapTicket(row: {
  id: string;
  editionId: string;
  venueId: string | null;
  name: string;
  description: string | null;
  code: string;
  priceAmount: number;
  currency: string;
  capacity: number | null;
  holdMinutes: number;
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  includedItems: Array<{
    productId: string;
    productVariantId: string | null;
    quantity: number;
    requiresVariantChoice: boolean;
    product: {
      id: string;
      name: string;
      isActive: boolean;
      variants: Array<{
        id: string;
        name: string;
        sku: string;
        stock: number;
        reservedStock: number;
        isActive: boolean;
      }>;
    };
    productVariant: {
      id: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      isActive: boolean;
    } | null;
  }>;
}): Promise<PublicCatalogTicket> {
  const usage = await countUsage(row.id);
  const avail = buildAvailability({
    ticketTypeId: row.id,
    capacity: row.capacity,
    confirmedCount: usage.confirmed,
    activeHoldCount: usage.activeHolds,
    waitlistedCount: 0,
    salesStartAt: row.salesStartAt,
    salesEndAt: row.salesEndAt,
    isActive: row.isActive,
  });

  const products: PublicTicketProductDto[] = row.includedItems.map((item) => {
    const variants = item.product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      availableStock: Math.max(0, v.stock - v.reservedStock),
      isActive: v.isActive,
    }));
    const fixed = item.productVariant
      ? {
          id: item.productVariant.id,
          name: item.productVariant.name,
          sku: item.productVariant.sku,
        }
      : null;
    return {
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      requiresVariantChoice: item.requiresVariantChoice,
      fixedVariant: fixed,
      variants,
    };
  });

  return {
    id: row.id,
    editionId: row.editionId,
    name: row.name,
    description: row.description,
    code: row.code,
    priceAmount: row.priceAmount,
    currency: row.currency,
    capacity: row.capacity,
    available: avail.available,
    isUnlimited: avail.isUnlimited,
    isSoldOut: avail.isSoldOut,
    holdMinutes: row.holdMinutes,
    salesStartAt: row.salesStartAt,
    salesEndAt: row.salesEndAt,
    salesStatus: avail.salesStatus,
    venueId: row.venueId,
    kitKind: kitKindOf(products),
    products,
  };
}

const ticketInclude = {
  includedItems: {
    include: {
      product: { include: { variants: true } },
      productVariant: true,
    },
  },
} as const;

function mapRecord(row: {
  id: string;
  editionId: string;
  venueId: string | null;
  userId: number;
  ticketTypeId: string;
  status: ClickatonRegistrationRecord["status"];
  paymentStatus: ClickatonRegistrationRecord["paymentStatus"];
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
  items: Array<{
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
}): ClickatonRegistrationRecord {
  return {
    id: row.id,
    editionId: row.editionId,
    venueId: row.venueId,
    userId: row.userId,
    ticketTypeId: row.ticketTypeId,
    status: row.status,
    paymentStatus: row.paymentStatus,
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
    items: row.items,
    paymentOrderId: row.paymentOrderId,
    paymentProvider: row.paymentProvider,
    paymentExternalReference: row.paymentExternalReference,
    paymentIdempotencyKey: row.paymentIdempotencyKey,
  };
}

export function createPrismaPublicRegistrationRepository(): PublicRegistrationRepository {
  return {
    async getEditionBySlug(slug) {
      const row = await prisma.clickatonEdition.findUnique({ where: { slug } });
      return row ? mapEdition(row) : null;
    },

    async listActiveVenues(editionId) {
      const rows = await prisma.clickatonVenue.findMany({
        where: { editionId, isActive: true },
        orderBy: { name: "asc" },
      });
      return rows.map(
        (v): PublicVenueDto => ({
          id: v.id,
          name: v.name,
          city: v.city,
          province: v.provinceOrState,
          address: v.address,
          startAt: v.startsAt,
          isActive: v.isActive,
        }),
      );
    },

    async listSellableTickets(editionId) {
      const rows = await prisma.clickatonTicketType.findMany({
        where: { editionId, isActive: true },
        include: ticketInclude,
        orderBy: { priceAmount: "asc" },
      });
      return Promise.all(rows.map((r) => mapTicket(r)));
    },

    async getTicketDetail(ticketTypeId) {
      const row = await prisma.clickatonTicketType.findUnique({
        where: { id: ticketTypeId },
        include: ticketInclude,
      });
      return row ? mapTicket(row) : null;
    },

    async countConfirmedAndActiveHolds(ticketTypeId) {
      return countUsage(ticketTypeId);
    },

    async findActiveByEditionEmail(editionId, email, now = new Date()) {
      const rows = await prisma.clickatonRegistration.findMany({
        where: {
          editionId,
          email: email.trim().toLowerCase(),
          status: { notIn: ["CANCELLED", "REFUNDED", "DISQUALIFIED"] },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      for (const row of rows) {
        const mapped = mapRecord(row);
        if (
          countsAsActiveRegistration({
            status: mapped.status,
            holdExpiresAt: mapped.holdExpiresAt,
            now,
          })
        ) {
          return mapped;
        }
      }
      return null;
    },

    async findActiveByEditionDocument(editionId, documentNumber, now = new Date()) {
      const normalized = normalizeDocument(documentNumber);
      if (!normalized) return null;
      const rows = await prisma.clickatonRegistration.findMany({
        where: {
          editionId,
          documentNumber: { not: null },
          status: { notIn: ["CANCELLED", "REFUNDED", "DISQUALIFIED"] },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      for (const row of rows) {
        if (normalizeDocument(row.documentNumber) !== normalized) continue;
        const mapped = mapRecord(row);
        if (
          countsAsActiveRegistration({
            status: mapped.status,
            holdExpiresAt: mapped.holdExpiresAt,
            now,
          })
        ) {
          return mapped;
        }
      }
      return null;
    },

    async findByIdempotencyKey(key) {
      const row = await prisma.clickatonRegistration.findFirst({
        where: { paymentIdempotencyKey: key },
        select: {
          id: true,
          paymentIdempotencyKey: true,
          createdAt: true,
          editionId: true,
          venueId: true,
          ticketTypeId: true,
          email: true,
          totalAmount: true,
        },
      });
      if (!row?.paymentIdempotencyKey) return null;
      // fingerprint se valida en servicio con payload; aquí devolvemos placeholder
      // almacenado en audit si existe
      const audit = await prisma.clickatonRegistrationAudit.findFirst({
        where: { registrationId: row.id, action: "PUBLIC_IDEMPOTENCY" },
        orderBy: { createdAt: "asc" },
      });
      const meta = (audit?.metadata ?? {}) as { fingerprint?: string };
      return {
        key: row.paymentIdempotencyKey,
        fingerprint: meta.fingerprint ?? "",
        registrationId: row.id,
        createdAt: row.createdAt,
      };
    },

    async resolveUserId(email, name) {
      const normalized = email.trim().toLowerCase();
      const user = await prisma.user.upsert({
        where: { email: normalized },
        create: {
          email: normalized,
          name: name.slice(0, 120),
          globalRole: "USER",
        },
        update: {},
        select: { id: true },
      });
      return user.id;
    },

    async createReservedRegistration(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const ticket = await tx.clickatonTicketType.findUnique({
            where: { id: input.cmd.ticket.ticketTypeId },
          });
          if (!ticket) {
            throw new PublicRegistrationError(
              "TICKET_NOT_AVAILABLE",
              "La entrada seleccionada no está disponible.",
            );
          }
          if (ticket.capacity != null) {
            const [confirmed, activeHolds] = await Promise.all([
              tx.clickatonRegistration.count({
                where: { ticketTypeId: ticket.id, status: "CONFIRMED" },
              }),
              tx.clickatonCapacityHold.count({
                where: {
                  ticketTypeId: ticket.id,
                  status: "ACTIVE",
                  expiresAt: { gt: new Date() },
                },
              }),
            ]);
            if (confirmed + activeHolds >= ticket.capacity) {
              throw new PublicRegistrationError(
                "CAPACITY_EXCEEDED",
                "No quedan cupos disponibles para esta entrada.",
              );
            }
          }

          for (const item of input.cmd.items) {
            if (!item.productVariantId) continue;
            const variant = await tx.clickatonProductVariant.findUnique({
              where: { id: item.productVariantId },
            });
            if (!variant || !variant.isActive) {
              throw new PublicRegistrationError(
                "INVALID_VARIANT",
                "Una variante del kit no está disponible.",
              );
            }
            if (variant.stock - variant.reservedStock < item.quantity) {
              throw new PublicRegistrationError(
                "PRODUCT_OUT_OF_STOCK",
                "Sin stock suficiente para completar la reserva.",
              );
            }
          }

          const nowTx = new Date();
          const emailDupes = await tx.clickatonRegistration.findMany({
            where: {
              editionId: input.cmd.editionId,
              email: input.cmd.participant.email,
              status: { notIn: ["CANCELLED", "REFUNDED", "DISQUALIFIED"] },
            },
            select: { id: true, status: true, holdExpiresAt: true },
            take: 10,
          });
          if (
            emailDupes.some((d) =>
              countsAsActiveRegistration({
                status: d.status,
                holdExpiresAt: d.holdExpiresAt,
                now: nowTx,
              }),
            )
          ) {
            throw new PublicRegistrationError(
              "DUPLICATE_REGISTRATION",
              "Ya existe una inscripción activa con este email para esta edición.",
            );
          }

          const paymentStatus =
            input.cmd.totalAmount === 0 ? "NOT_REQUIRED" : "PENDING";

          const created = await tx.clickatonRegistration.create({
            data: {
              editionId: input.cmd.editionId,
              venueId: input.cmd.ticket.venueId ?? null,
              userId: input.cmd.userId,
              ticketTypeId: input.cmd.ticket.ticketTypeId,
              status: "PENDING_PAYMENT",
              paymentStatus,
              firstName: input.cmd.participant.firstName,
              lastName: input.cmd.participant.lastName,
              email: input.cmd.participant.email,
              phone: input.cmd.participant.phone ?? null,
              documentNumber: input.cmd.participant.documentNumber ?? null,
              city: input.cmd.participant.city ?? null,
              province: input.cmd.participant.province ?? null,
              country: input.cmd.participant.country,
              birthDate: input.cmd.participant.birthDate ?? null,
              emergencyContactName: input.cmd.participant.emergencyContactName ?? null,
              emergencyContactPhone: input.cmd.participant.emergencyContactPhone ?? null,
              acceptedTermsAt: input.cmd.participant.acceptedTermsAt ?? null,
              acceptedImageAt: input.cmd.participant.acceptedImageAt ?? null,
              currency: input.cmd.currency,
              subtotalAmount: input.cmd.subtotalAmount,
              discountAmount: input.cmd.discountAmount,
              totalAmount: input.cmd.totalAmount,
              holdExpiresAt: input.holdExpiresAt,
              paymentIdempotencyKey: input.idempotencyKey,
              items: {
                create: input.cmd.items.map((item) => ({
                  productId: item.productId ?? null,
                  productVariantId: item.productVariantId ?? null,
                  nameSnapshot: item.nameSnapshot,
                  skuSnapshot: item.skuSnapshot ?? null,
                  quantity: item.quantity,
                  unitPriceAmount: item.unitPriceAmount,
                  totalPriceAmount: item.totalPriceAmount,
                  currency: item.currency,
                  isIncluded: item.isIncluded,
                })),
              },
              capacityHold: {
                create: {
                  editionId: input.cmd.editionId,
                  venueId: input.cmd.ticket.venueId ?? null,
                  ticketTypeId: input.cmd.ticket.ticketTypeId,
                  status: "ACTIVE",
                  expiresAt: input.holdExpiresAt,
                },
              },
              statusHistory: {
                create: {
                  previousStatus: null,
                  newStatus: "PENDING_PAYMENT",
                  previousPaymentStatus: null,
                  newPaymentStatus: paymentStatus,
                  source: "public_registration",
                  reason: "Reserva pública creada",
                },
              },
              audits: {
                create: [
                  {
                    action: "PUBLIC_REGISTRATION_CREATED",
                    source: "public",
                    actorUserId: input.cmd.userId,
                    metadata: { idempotencyKey: input.idempotencyKey },
                  },
                  {
                    action: "PUBLIC_IDEMPOTENCY",
                    source: "public",
                    actorUserId: input.cmd.userId,
                    metadata: { fingerprint: input.fingerprint },
                  },
                ],
              },
            },
            include: { items: true },
          });

          for (const item of input.cmd.items) {
            if (!item.productVariantId) continue;
            await tx.clickatonStockHold.create({
              data: {
                registrationId: created.id,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                status: "ACTIVE",
                expiresAt: input.holdExpiresAt,
              },
            });
            await tx.clickatonProductVariant.update({
              where: { id: item.productVariantId },
              data: { reservedStock: { increment: item.quantity } },
            });
          }

          return mapRecord(created);
        }, { maxWait: 10_000, timeout: 20_000 });
      } catch (error) {
        if (error instanceof PublicRegistrationError) throw error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new PublicRegistrationError(
            "IDEMPOTENCY_CONFLICT",
            "Esta solicitud ya fue procesada. Recargá el resumen o intentá de nuevo.",
          );
        }
        throw error;
      }
    },

    async getRegistration(id) {
      const row = await prisma.clickatonRegistration.findUnique({
        where: { id },
        include: { items: true },
      });
      return row ? mapRecord(row) : null;
    },

    async getHoldSnapshot(registrationId) {
      const now = new Date();
      const [capacity, stock] = await Promise.all([
        prisma.clickatonCapacityHold.count({
          where: {
            registrationId,
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
        }),
        prisma.clickatonStockHold.count({
          where: {
            registrationId,
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
        }),
      ]);
      return { capacityHoldActive: capacity > 0, stockHoldsActive: stock };
    },

    async listExpireCandidates({ now, limit }) {
      const rows = await prisma.clickatonRegistration.findMany({
        where: {
          status: { in: ["PENDING_PAYMENT", "DRAFT"] },
          paymentStatus: { not: "APPROVED" },
          holdExpiresAt: { lte: now },
        },
        select: { id: true, status: true, paymentStatus: true, holdExpiresAt: true },
        orderBy: { holdExpiresAt: "asc" },
        take: limit,
      });
      return rows
        .filter((r) =>
          isExpireCandidate({
            status: r.status,
            paymentStatus: r.paymentStatus,
            holdExpiresAt: r.holdExpiresAt,
            now,
          }),
        )
        .map((r) => r.id);
    },

    async expireRegistration({ registrationId, now, dryRun }) {
      return prisma.$transaction(async (tx) => {
        const row = await tx.clickatonRegistration.findUnique({
          where: { id: registrationId },
          include: {
            capacityHold: true,
            stockHolds: true,
          },
        });
        if (!row) return { outcome: "skipped" as const, registrationId, reason: "not_found" };

        if (
          row.status === EXPIRATION_TARGET.status &&
          row.paymentStatus === EXPIRATION_TARGET.paymentStatus
        ) {
          return { outcome: "already_processed" as const, registrationId };
        }

        if (
          !isExpireCandidate({
            status: row.status,
            paymentStatus: row.paymentStatus,
            holdExpiresAt: row.holdExpiresAt,
            now,
          })
        ) {
          return { outcome: "skipped" as const, registrationId, reason: "not_candidate" };
        }

        let releasedCapacityHolds = 0;
        let releasedStockHolds = 0;
        if (row.capacityHold?.status === "ACTIVE") releasedCapacityHolds = 1;
        releasedStockHolds = row.stockHolds.filter((h) => h.status === "ACTIVE").length;

        if (dryRun) {
          return {
            outcome: "expired" as const,
            registrationId,
            releasedCapacityHolds,
            releasedStockHolds,
          };
        }

        if (row.capacityHold?.status === "ACTIVE") {
          await tx.clickatonCapacityHold.update({
            where: { id: row.capacityHold.id },
            data: { status: "EXPIRED", releasedAt: now },
          });
        }

        for (const hold of row.stockHolds) {
          if (hold.status !== "ACTIVE") continue;
          await tx.clickatonStockHold.update({
            where: { id: hold.id },
            data: { status: "EXPIRED", releasedAt: now },
          });
          await tx.clickatonProductVariant.update({
            where: { id: hold.productVariantId },
            data: { reservedStock: { decrement: hold.quantity } },
          });
        }

        await tx.clickatonRegistration.update({
          where: { id: registrationId },
          data: {
            status: EXPIRATION_TARGET.status,
            paymentStatus: EXPIRATION_TARGET.paymentStatus,
            cancelledAt: now,
          },
        });

        await tx.clickatonRegistrationStatusHistory.create({
          data: {
            registrationId,
            previousStatus: row.status,
            newStatus: EXPIRATION_TARGET.status,
            previousPaymentStatus: row.paymentStatus,
            newPaymentStatus: EXPIRATION_TARGET.paymentStatus,
            source: "expire_holds",
            reason: "hold_expired",
          },
        });

        await tx.clickatonRegistrationAudit.create({
          data: {
            registrationId,
            action: EXPIRATION_TARGET.auditAction,
            source: "expire_holds",
            metadata: { reason: "hold_expired" },
          },
        });

        return {
          outcome: "expired" as const,
          registrationId,
          releasedCapacityHolds,
          releasedStockHolds,
        };
      });
    },

    buildSummary({
      registration,
      edition,
      venueName,
      ticketName,
      accessToken,
      isExpired,
      reservationActive,
      checkoutEligible,
    }) {
      const last = registration.participant.lastName?.trim() ?? "";
      return {
        registrationId: registration.id,
        publicCode: registration.visibleCode ?? null,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        isExpired,
        reservationActive,
        editionName: edition.name,
        editionSlug: edition.slug,
        venueName,
        ticketName,
        participant: {
          firstName: displayPublicFirstName(registration.participant.firstName),
          lastNameInitial: last ? `${last[0]!.toUpperCase()}.` : "—",
          emailMasked: maskEmail(registration.participant.email),
          phoneMasked: maskPhone(registration.participant.phone),
          documentMasked: maskDocument(registration.participant.documentNumber),
        },
        totalAmount: registration.money.totalAmount,
        currency: registration.money.currency,
        items: registration.items.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          skuSnapshot: i.skuSnapshot ?? null,
          quantity: i.quantity,
        })),
        holdExpiresAt: registration.holdExpiresAt ?? null,
        accessToken,
        nextStepMessage: checkoutEligible
          ? "Entorno de prueba: podés continuar al pago sandbox. No se realizará un cobro real."
          : registration.status === "CONFIRMED"
            ? "Inscripción confirmada. Entrá a Mi cuenta para ver QR y credencial."
            : isExpired
              ? "La reserva venció. El cupo fue liberado. Podés iniciar una nueva inscripción si hay cupo."
              : "Esta inscripción no admite continuar al pago.",
        checkoutEligible,
      };
    },
  };
}
