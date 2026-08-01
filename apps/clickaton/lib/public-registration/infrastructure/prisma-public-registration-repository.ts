import { Prisma, prisma } from "@/lib/admin/db";
import { buildAvailability } from "@/lib/admin-catalog/domain/availability";
import { releaseClickatonPromotionRedemption } from "@/lib/promotions/prisma-promotions-adapter";
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
import { isMarathonPackTicketCode } from "@/lib/packs/marathon-pack";

function mapEdition(row: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isPublished: boolean;
  registrationEnabled: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  currency: string;
  visibleCodePrefix: string | null;
}): PublicCatalogEdition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    status: row.status,
    isPublished: row.isPublished,
    registrationEnabled: row.registrationEnabled,
    registrationOpenAt: row.registrationOpenAt,
    registrationCloseAt: row.registrationCloseAt,
    startAt: row.startAt,
    endAt: row.endAt,
    timezone: row.timezone,
    currency: row.currency,
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
    id: string;
    productId: string;
    productVariantId: string | null;
    quantity: number;
    requiresVariantChoice: boolean;
    product: {
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      archivedAt?: Date | null;
      primaryImageAssetId?: string | null;
      sizeChartAssetId?: string | null;
      sizeChartDescription?: string | null;
      sizeChartInstructions?: string | null;
      media?: Array<{
        assetId: string;
        mediaType: string;
        sortOrder: number;
        altText: string | null;
        caption: string | null;
        status: string;
      }>;
      variants: Array<{
        id: string;
        code?: string;
        name: string;
        sku: string;
        stock: number;
        reservedStock: number;
        isActive: boolean;
        sortOrder?: number;
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

  const assetIds = new Set<string>();
  for (const item of row.includedItems) {
    if (item.product.primaryImageAssetId) assetIds.add(item.product.primaryImageAssetId);
    if (item.product.sizeChartAssetId) assetIds.add(item.product.sizeChartAssetId);
    for (const m of item.product.media ?? []) {
      if (m.status === "ACTIVE") assetIds.add(m.assetId);
    }
  }
  const assets =
    assetIds.size > 0
      ? await prisma.dnxMediaAsset.findMany({
          where: { id: { in: [...assetIds] } },
          select: { id: true, publicUrl: true },
        })
      : [];
  const assetUrl = new Map(assets.map((a) => [a.id, a.publicUrl]));

  const products: PublicTicketProductDto[] = row.includedItems.map((item) => {
    const variants = [...item.product.variants]
      .sort((a, b) => {
        const ao = "sortOrder" in a && typeof a.sortOrder === "number" ? a.sortOrder : 100;
        const bo = "sortOrder" in b && typeof b.sortOrder === "number" ? b.sortOrder : 100;
        return ao - bo;
      })
      .map((v) => ({
        id: v.id,
        code: "code" in v && typeof v.code === "string" ? v.code : undefined,
        name: v.name,
        sku: v.sku,
        availableStock: Math.max(0, v.stock - v.reservedStock),
        isActive: v.isActive,
        sortOrder: "sortOrder" in v && typeof v.sortOrder === "number" ? v.sortOrder : 100,
      }));
    const fixed = item.productVariant
      ? {
          id: item.productVariant.id,
          name: item.productVariant.name,
          sku: item.productVariant.sku,
        }
      : null;
    const gallery = (item.product.media ?? [])
      .filter((m) => m.status === "ACTIVE" && m.mediaType === "GALLERY")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        url: assetUrl.get(m.assetId) ?? null,
        altText: m.altText,
        caption: m.caption,
        sortOrder: m.sortOrder,
      }));
    return {
      ticketTypeItemId: item.id,
      pricePhaseItemId: null,
      sourceType: "TICKET_BASE" as const,
      productId: item.productId,
      productName: item.product.name,
      productDescription: item.product.description,
      quantity: item.quantity,
      requiresVariantChoice: item.requiresVariantChoice,
      fulfillmentRequired: true,
      primaryImageUrl: item.product.primaryImageAssetId
        ? (assetUrl.get(item.product.primaryImageAssetId) ?? null)
        : null,
      sizeChartUrl: item.product.sizeChartAssetId
        ? (assetUrl.get(item.product.sizeChartAssetId) ?? null)
        : null,
      sizeChartDescription: item.product.sizeChartDescription ?? null,
      sizeChartInstructions: item.product.sizeChartInstructions ?? null,
      gallery,
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
    isMarathonPack: isMarathonPackTicketCode(row.code),
  };
}

const ticketInclude = {
  includedItems: {
    include: {
      product: {
        include: {
          variants: { orderBy: { sortOrder: "asc" as const } },
          media: { orderBy: { sortOrder: "asc" as const } },
        },
      },
      productVariant: true,
    },
  },
} as const;

function mapRecord(row: {
  id: string;
  editionId: string;
  venueId: string | null;
  userId: number | null;
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
    ticketTypeItemId?: string | null;
    productId: string | null;
    productVariantId: string | null;
    nameSnapshot: string;
    variantNameSnapshot?: string | null;
    skuSnapshot: string | null;
    quantity: number;
    unitPriceAmount: number;
    totalPriceAmount: number;
    currency: string;
    isIncluded: boolean;
    fulfillmentStatus?: import("@/lib/registration/domain/types").ClickatonItemFulfillmentStatus;
    fulfilledAt?: Date | null;
    fulfilledByUserId?: number | null;
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

    async listPricePhases(editionId) {
      return prisma.clickatonRegistrationPricePhase.findMany({
        where: { editionId },
        orderBy: [{ startsAt: "asc" }, { priority: "asc" }],
      });
    },

    async listPricePhaseItems(pricePhaseId) {
      const rows = await prisma.clickatonPricePhaseItem.findMany({
        where: { pricePhaseId, isIncluded: true },
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: {
              variants: { orderBy: { sortOrder: "asc" } },
              media: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      });

      const assetIds = new Set<string>();
      for (const row of rows) {
        if (row.product.primaryImageAssetId) assetIds.add(row.product.primaryImageAssetId);
        if (row.product.sizeChartAssetId) assetIds.add(row.product.sizeChartAssetId);
        for (const m of row.product.media) {
          if (m.status === "ACTIVE") assetIds.add(m.assetId);
        }
      }
      const assets =
        assetIds.size > 0
          ? await prisma.dnxMediaAsset.findMany({
              where: { id: { in: [...assetIds] } },
              select: { id: true, publicUrl: true },
            })
          : [];
      const assetUrl = new Map(assets.map((a) => [a.id, a.publicUrl]));

      return rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        requiresVariantChoice: row.requiresVariantChoice,
        isIncluded: row.isIncluded,
        fulfillmentRequired: row.fulfillmentRequired,
        displayTitle: row.displayTitle,
        displayDescription: row.displayDescription,
        sortOrder: row.sortOrder,
        stockLimit: row.stockLimit,
        benefitDeadlineAt: row.benefitDeadlineAt,
        product: {
          id: row.product.id,
          name: row.product.name,
          description: row.product.description,
          isActive: row.product.isActive,
          archivedAt: row.product.archivedAt,
          primaryImageAssetId: row.product.primaryImageAssetId,
          primaryImageUrl: row.product.primaryImageAssetId
            ? (assetUrl.get(row.product.primaryImageAssetId) ?? null)
            : null,
          sizeChartAssetId: row.product.sizeChartAssetId,
          sizeChartUrl: row.product.sizeChartAssetId
            ? (assetUrl.get(row.product.sizeChartAssetId) ?? null)
            : null,
          sizeChartDescription: row.product.sizeChartDescription,
          sizeChartInstructions: row.product.sizeChartInstructions,
          gallery: row.product.media
            .filter((m) => m.status === "ACTIVE" && m.mediaType === "GALLERY")
            .map((m) => ({
              assetId: m.assetId,
              url: assetUrl.get(m.assetId) ?? null,
              altText: m.altText,
              caption: m.caption,
              sortOrder: m.sortOrder,
            })),
          variants: row.product.variants.map((v) => ({
            id: v.id,
            code: v.code,
            name: v.name,
            sku: v.sku,
            stock: v.stock,
            reservedStock: v.reservedStock,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
          })),
        },
      }));
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

    async resolveIdentityCandidate(email) {
      const normalized = email.trim().toLowerCase();
      const user = await prisma.user.findUnique({
        where: { email: normalized },
        select: { id: true, isBlocked: true },
      });
      if (!user || user.isBlocked) {
        return { userId: null, existingUserCandidate: false };
      }
      return { userId: user.id, existingUserCandidate: true };
    },

    async countPhaseConfirmedAndActiveHolds(pricePhaseId) {
      const now = new Date();
      const [confirmed, activeHolds] = await Promise.all([
        prisma.clickatonRegistration.count({
          where: { pricePhaseId, status: "CONFIRMED" },
        }),
        prisma.clickatonCapacityHold.count({
          where: {
            status: "ACTIVE",
            expiresAt: { gt: now },
            registration: { pricePhaseId },
          },
        }),
      ]);
      return { confirmed, activeHolds };
    },

    async countPhaseBenefitClaims(pricePhaseItemIds) {
      const confirmedByItemId = new Map<string, number>();
      const heldByItemId = new Map<string, number>();
      const confirmedByProductId = new Map<string, number>();
      const heldByProductId = new Map<string, number>();
      for (const id of pricePhaseItemIds) {
        confirmedByItemId.set(id, 0);
        heldByItemId.set(id, 0);
      }
      if (pricePhaseItemIds.length === 0) {
        return {
          confirmedByItemId,
          heldByItemId,
          confirmedByProductId,
          heldByProductId,
        };
      }

      const items = await prisma.clickatonPricePhaseItem.findMany({
        where: { id: { in: pricePhaseItemIds } },
        select: { id: true, productId: true },
      });
      const productIds = [...new Set(items.map((i) => i.productId))];
      const itemToProduct = new Map(items.map((i) => [i.id, i.productId]));
      for (const pid of productIds) {
        confirmedByProductId.set(pid, 0);
        heldByProductId.set(pid, 0);
      }

      const now = new Date();
      const [confirmedRows, heldRows] = await Promise.all([
        prisma.clickatonRegistrationItem.groupBy({
          by: ["pricePhaseItemId"],
          where: {
            pricePhaseItemId: { in: pricePhaseItemIds },
            registration: { status: "CONFIRMED" },
          },
          _count: { _all: true },
        }),
        prisma.clickatonRegistrationItem.groupBy({
          by: ["pricePhaseItemId"],
          where: {
            pricePhaseItemId: { in: pricePhaseItemIds },
            registration: {
              status: "PENDING_PAYMENT",
              capacityHold: {
                status: "ACTIVE",
                expiresAt: { gt: now },
              },
            },
          },
          _count: { _all: true },
        }),
      ]);

      for (const row of confirmedRows) {
        if (!row.pricePhaseItemId) continue;
        confirmedByItemId.set(row.pricePhaseItemId, row._count._all);
        const pid = itemToProduct.get(row.pricePhaseItemId);
        if (pid) {
          confirmedByProductId.set(
            pid,
            (confirmedByProductId.get(pid) ?? 0) + row._count._all,
          );
        }
      }
      for (const row of heldRows) {
        if (!row.pricePhaseItemId) continue;
        heldByItemId.set(row.pricePhaseItemId, row._count._all);
        const pid = itemToProduct.get(row.pricePhaseItemId);
        if (pid) {
          heldByProductId.set(pid, (heldByProductId.get(pid) ?? 0) + row._count._all);
        }
      }

      return {
        confirmedByItemId,
        heldByItemId,
        confirmedByProductId,
        heldByProductId,
      };
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

          const phaseId = input.cmd.pricePhaseId ?? null;
          if (phaseId) {
            const phase = await tx.clickatonRegistrationPricePhase.findUnique({
              where: { id: phaseId },
              select: { capacity: true, name: true },
            });
            if (phase?.capacity != null) {
              const nowTx = new Date();
              const [phaseConfirmed, phaseActiveHolds] = await Promise.all([
                tx.clickatonRegistration.count({
                  where: { pricePhaseId: phaseId, status: "CONFIRMED" },
                }),
                tx.clickatonCapacityHold.count({
                  where: {
                    status: "ACTIVE",
                    expiresAt: { gt: nowTx },
                    registration: { pricePhaseId: phaseId },
                  },
                }),
              ]);
              if (phaseConfirmed + phaseActiveHolds >= phase.capacity) {
                throw new PublicRegistrationError(
                  "PHASE_CAPACITY_EXCEEDED",
                  `Se agotó el cupo de la fase «${phase.name}».`,
                );
              }
            }
          }

          // First-N benefit: strip exhausted PRICE_PHASE items.
          // Does NOT throw PHASE_CAPACITY — N+1 still registers without the benefit.
          // First-N path documented as non-capacity (≠ phase.capacity seats).
          let reservedItems = [...input.cmd.items];
          const phaseItemIds = [
            ...new Set(
              reservedItems
                .map((i) => i.pricePhaseItemId)
                .filter((id): id is string => Boolean(id)),
            ),
          ];
          if (phaseItemIds.length > 0) {
            const {
              isFirstNBenefitAvailable,
            } = await import("@/lib/catalog/domain/first-n-benefit");
            const limits = await tx.clickatonPricePhaseItem.findMany({
              where: { id: { in: phaseItemIds } },
              select: {
                id: true,
                productId: true,
                stockLimit: true,
                benefitDeadlineAt: true,
              },
            });
            const limitById = new Map(limits.map((l) => [l.id, l]));
            const nowClaims = new Date();
            const productIds = [...new Set(limits.map((l) => l.productId))];
            const [confirmedRows, heldRows] = await Promise.all([
              tx.clickatonRegistrationItem.groupBy({
                by: ["pricePhaseItemId"],
                where: {
                  pricePhaseItemId: { in: phaseItemIds },
                  registration: { status: "CONFIRMED" },
                },
                _count: { _all: true },
              }),
              tx.clickatonRegistrationItem.groupBy({
                by: ["pricePhaseItemId"],
                where: {
                  pricePhaseItemId: { in: phaseItemIds },
                  registration: {
                    status: "PENDING_PAYMENT",
                    capacityHold: {
                      status: "ACTIVE",
                      expiresAt: { gt: nowClaims },
                    },
                  },
                },
                _count: { _all: true },
              }),
            ]);
            const confirmedByProduct = new Map<string, number>();
            const heldByProduct = new Map<string, number>();
            for (const pid of productIds) {
              confirmedByProduct.set(pid, 0);
              heldByProduct.set(pid, 0);
            }
            const itemToProduct = new Map(limits.map((l) => [l.id, l.productId]));
            for (const row of confirmedRows) {
              if (!row.pricePhaseItemId) continue;
              const pid = itemToProduct.get(row.pricePhaseItemId);
              if (pid) {
                confirmedByProduct.set(
                  pid,
                  (confirmedByProduct.get(pid) ?? 0) + row._count._all,
                );
              }
            }
            for (const row of heldRows) {
              if (!row.pricePhaseItemId) continue;
              const pid = itemToProduct.get(row.pricePhaseItemId);
              if (pid) {
                heldByProduct.set(
                  pid,
                  (heldByProduct.get(pid) ?? 0) + row._count._all,
                );
              }
            }
            // Does NOT throw PHASE_CAPACITY — N+1 still registers without the benefit.
            reservedItems = reservedItems.filter((item) => {
              if (!item.pricePhaseItemId) return true;
              const meta = limitById.get(item.pricePhaseItemId);
              if (!meta) return true;
              return isFirstNBenefitAvailable({
                stockLimit: meta.stockLimit,
                confirmedClaims: confirmedByProduct.get(meta.productId) ?? 0,
                heldClaims: heldByProduct.get(meta.productId) ?? 0,
                now: nowClaims,
                benefitDeadlineAt: meta.benefitDeadlineAt,
              });
            });
          }

          for (const item of reservedItems) {
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
              pricePhaseId: input.cmd.pricePhaseId ?? null,
              pricePhaseNameSnapshot: input.cmd.pricePhaseNameSnapshot ?? null,
              pricePhaseAmountSnapshot: input.cmd.pricePhaseAmountSnapshot ?? null,
              promotionId: input.cmd.promotionId ?? null,
              promotionCodeSnapshot: input.cmd.promotionCodeSnapshot ?? null,
              instagramHandle: input.cmd.instagramHandle ?? null,
              instagramHandleNormalized: input.cmd.instagramHandleNormalized ?? null,
              instagramUrl: input.cmd.instagramUrl ?? null,
              profilePhotoAssetId: input.cmd.profilePhotoAssetId ?? null,
              profilePhotoSource: input.cmd.profilePhotoAssetId ? "USER_UPLOAD" : null,
              profilePhotoStatus: input.cmd.profilePhotoAssetId ? "READY" : null,
              imageUsageConsent: input.cmd.imageUsageConsent ?? false,
              socialPublicationConsent: input.cmd.socialPublicationConsent ?? false,
              consentAcceptedAt: input.cmd.consentAcceptedAt ?? null,
              consentVersion: input.cmd.consentVersion ?? null,
              termsVersion: input.cmd.termsVersion ?? null,
              termsAcceptedAt: input.cmd.termsAcceptedAt ?? null,
              promotionalLicenseAcceptedAt: input.cmd.promotionalLicenseAcceptedAt ?? null,
              identifiablePersonsDeclaredAt: input.cmd.identifiablePersonsDeclaredAt ?? null,
              identifiablePersonsPolicyVersion:
                input.cmd.identifiablePersonsPolicyVersion ?? null,
              holdExpiresAt: input.holdExpiresAt,
              paymentIdempotencyKey: input.idempotencyKey,
              items: {
                create: reservedItems.map((item) => ({
                  ticketTypeItemId: item.ticketTypeItemId ?? null,
                  pricePhaseItemId: item.pricePhaseItemId ?? null,
                  sourceType: item.sourceType ?? "TICKET_BASE",
                  productId: item.productId ?? null,
                  productVariantId: item.productVariantId ?? null,
                  nameSnapshot: item.nameSnapshot,
                  productNameSnapshot: item.productNameSnapshot ?? null,
                  productDescriptionSnapshot: item.productDescriptionSnapshot ?? null,
                  variantNameSnapshot: item.variantNameSnapshot ?? null,
                  skuSnapshot: item.skuSnapshot ?? null,
                  quantity: item.quantity,
                  unitPriceAmount: item.unitPriceAmount,
                  totalPriceAmount: item.totalPriceAmount,
                  currency: item.currency,
                  isIncluded: item.isIncluded,
                  imageAssetIdSnapshot: item.imageAssetIdSnapshot ?? null,
                  sizeChartAssetIdSnapshot: item.sizeChartAssetIdSnapshot ?? null,
                  fulfillmentStatus: "PENDING",
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

          for (const item of reservedItems) {
            if (!item.productVariantId || !item.productId) continue;
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
            const holdKey = `reg:${created.id}:var:${item.productVariantId}:hold`;
            const existingMove = await tx.clickatonInventoryMovement.findUnique({
              where: { idempotencyKey: holdKey },
            });
            if (!existingMove) {
              await tx.clickatonInventoryMovement.create({
                data: {
                  productId: item.productId,
                  variantId: item.productVariantId,
                  movementType: "REGISTRATION_HOLD",
                  quantity: item.quantity,
                  sourceType: "REGISTRATION",
                  sourceId: created.id,
                  reason: "Hold de stock por reserva de inscripción",
                  idempotencyKey: holdKey,
                  metadata: {
                    sourceType: item.sourceType ?? "TICKET_BASE",
                    pricePhaseItemId: item.pricePhaseItemId ?? null,
                  },
                },
              });
            }
          }

          if (input.cmd.profilePhotoAssetId) {
            const asset = await tx.dnxMediaAsset.findUnique({
              where: { id: input.cmd.profilePhotoAssetId },
              select: { ownerId: true, platform: true },
            });
            if (!asset || asset.platform !== "CLICKATON") {
              throw new PublicRegistrationError("INVALID_VARIANT", "La foto de perfil no es válida.");
            }
            await tx.dnxMediaAsset.updateMany({
              where: { ownerId: asset.ownerId, platform: "CLICKATON" },
              data: {
                ownerType: "REGISTRATION", ownerId: created.id,
                registrationId: created.id, editionId: created.editionId,
              },
            });
          }

          return mapRecord(created);
        }, { maxWait: 15_000, timeout: 45_000 });
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
          const variant = await tx.clickatonProductVariant.update({
            where: { id: hold.productVariantId },
            data: { reservedStock: { decrement: hold.quantity } },
          });
          const releaseKey = `reg:${registrationId}:var:${hold.productVariantId}:release`;
          const existingRelease = await tx.clickatonInventoryMovement.findUnique({
            where: { idempotencyKey: releaseKey },
          });
          if (!existingRelease) {
            await tx.clickatonInventoryMovement.create({
              data: {
                productId: variant.productId,
                variantId: hold.productVariantId,
                movementType: "REGISTRATION_RELEASED",
                quantity: hold.quantity,
                sourceType: "REGISTRATION",
                sourceId: registrationId,
                reason: "Hold expirado / liberado",
                idempotencyKey: releaseKey,
              },
            });
          }
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
      }).then(async (result) => {
        if (result.outcome === "expired" && !dryRun) {
          try {
            await releaseClickatonPromotionRedemption(registrationId);
          } catch {
            // best-effort: no bloquear expiración de hold
          }
        }
        return result;
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
        subtotalAmount: registration.money.subtotalAmount,
        discountAmount: registration.money.discountAmount,
        totalAmount: registration.money.totalAmount,
        currency: registration.money.currency,
        items: registration.items.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          variantNameSnapshot: i.variantNameSnapshot ?? null,
          skuSnapshot: null,
          quantity: i.quantity,
          isIncluded: i.isIncluded,
        })),
        holdExpiresAt: registration.holdExpiresAt ?? null,
        accessToken,
        nextStepMessage: checkoutEligible
          ? registration.money.totalAmount === 0
            ? "Podés confirmar tu inscripción gratuita. No se realizará ningún cobro."
            : "Completá el pago seguro con Mercado Pago. Cuando se acredite, confirmaremos tu inscripción."
          : registration.status === "CONFIRMED"
            ? "Inscripción confirmada. Entrá a Mi cuenta para ver el QR y la credencial."
            : isExpired
              ? "La reserva venció. El cupo fue liberado. Podés iniciar una nueva inscripción si hay cupo."
              : "Esta inscripción no admite continuar al pago.",
        checkoutEligible,
      };
    },
  };
}
