import { Prisma, prisma } from "@/lib/admin/db";
import { buildAvailability, buildVariantStockView } from "../domain/availability";
import {
  CatalogDuplicateCodeError,
  CatalogDuplicateSkuError,
  CatalogEditionMismatchError,
  CatalogNotFoundError,
  CatalogStockError,
  CatalogValidationError,
} from "../domain/errors";
import type {
  ClickatonAdminCatalogRepository,
  CreateProductData,
  UpdateProductData,
  CreateTicketTypeData,
  CreateVariantData,
  UpdateTicketTypeData,
} from "../domain/repository";
import type {
  ProductFilters,
  ProductListItem,
  ProductRecord,
  ProductVariantRecord,
  RegistrationUsage,
  TicketTypeFilters,
  TicketTypeItemInput,
  TicketTypeRecord,
} from "../domain/types";

function mapVariant(v: {
  id: string;
  productId: string;
  code: string;
  name: string;
  sku: string;
  stock: number;
  reservedStock: number;
  priceAmount: number | null;
  currency: string | null;
  sortOrder?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductVariantRecord {
  return {
    id: v.id,
    productId: v.productId,
    code: v.code,
    name: v.name,
    sku: v.sku,
    stock: v.stock,
    reservedStock: v.reservedStock,
    priceAmount: v.priceAmount,
    currency: (v.currency as "ARS" | null) ?? null,
    sortOrder: v.sortOrder ?? 100,
    isActive: v.isActive,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function mapTicket(
  t: {
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
    createdAt: Date;
    updatedAt: Date;
    includedItems: Array<{
      id: string;
      productId: string;
      productVariantId: string | null;
      quantity: number;
      requiresVariantChoice: boolean;
    }>;
  },
): TicketTypeRecord {
  return {
    id: t.id,
    editionId: t.editionId,
    venueId: t.venueId,
    name: t.name,
    description: t.description,
    code: t.code,
    priceAmount: t.priceAmount,
    currency: t.currency as "ARS",
    capacity: t.capacity,
    holdMinutes: t.holdMinutes,
    isActive: t.isActive,
    salesStartAt: t.salesStartAt,
    salesEndAt: t.salesEndAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    items: t.includedItems.map((i) => ({
      id: i.id,
      productId: i.productId,
      productVariantId: i.productVariantId,
      quantity: i.quantity,
      requiresVariantChoice: i.requiresVariantChoice,
    })),
  };
}

function mapProduct(p: {
  id: string;
  editionId: string;
  name: string;
  description: string | null;
  code: string;
  isActive: boolean;
  primaryImageAssetId?: string | null;
  sizeChartAssetId?: string | null;
  sizeChartDescription?: string | null;
  sizeChartInstructions?: string | null;
  isStoreEnabled?: boolean;
  storeStatus?: string;
  storeSlug?: string | null;
  storeTitle?: string | null;
  storeDescription?: string | null;
  storePrice?: number | null;
  compareAtPrice?: number | null;
  storeCurrency?: string;
  requiresShipping?: boolean;
  allowPickup?: boolean;
  createdAt: Date;
  updatedAt: Date;
  variants: Array<Parameters<typeof mapVariant>[0]>;
}): ProductRecord {
  return {
    id: p.id,
    editionId: p.editionId,
    name: p.name,
    description: p.description,
    code: p.code,
    isActive: p.isActive,
    primaryImageAssetId: p.primaryImageAssetId ?? null,
    sizeChartAssetId: p.sizeChartAssetId ?? null,
    sizeChartDescription: p.sizeChartDescription ?? null,
    sizeChartInstructions: p.sizeChartInstructions ?? null,
    isStoreEnabled: p.isStoreEnabled ?? false,
    storeStatus: (p.storeStatus ?? "DRAFT") as ProductRecord["storeStatus"],
    storeSlug: p.storeSlug ?? null,
    storeTitle: p.storeTitle ?? null,
    storeDescription: p.storeDescription ?? null,
    storePrice: p.storePrice ?? null,
    compareAtPrice: p.compareAtPrice ?? null,
    storeCurrency: (p.storeCurrency ?? "ARS") as ProductRecord["storeCurrency"],
    requiresShipping: p.requiresShipping ?? false,
    allowPickup: p.allowPickup ?? true,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map(mapVariant),
  };
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      if (target.includes("sku")) throw new CatalogDuplicateSkuError("SKU");
      throw new CatalogDuplicateCodeError("único", target);
    }
    if (error.code === "P2025") throw new CatalogNotFoundError("Registro");
  }
  throw error;
}

export function createPrismaCatalogRepository(): ClickatonAdminCatalogRepository {
  async function assertCompositionItems(editionId: string, items: TicketTypeItemInput[]) {
    for (const item of items) {
      const product = await prisma.clickatonProduct.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!product || product.editionId !== editionId) {
        throw new CatalogEditionMismatchError("Producto fuera de la edición.");
      }
      if (!product.isActive) {
        throw new CatalogValidationError({ items: `Producto inactivo: ${product.code}` });
      }
      if (item.productVariantId) {
        const variant = product.variants.find((v) => v.id === item.productVariantId);
        if (!variant) throw new CatalogEditionMismatchError("Variante inválida.");
        if (!variant.isActive) {
          throw new CatalogValidationError({ items: `Variante inactiva: ${variant.code}` });
        }
      }
    }
  }

  return {
    async getEdition(editionId) {
      const row = await prisma.clickatonEdition.findUnique({
        where: { id: editionId },
        select: { id: true, status: true, name: true },
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

    async listTicketTypes(filters: TicketTypeFilters) {
      const rows = await prisma.clickatonTicketType.findMany({
        where: {
          editionId: filters.editionId,
          ...(filters.venueId !== undefined ? { venueId: filters.venueId } : {}),
          ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
          ...(filters.query
            ? {
                OR: [
                  { name: { contains: filters.query, mode: "insensitive" } },
                  { code: { contains: filters.query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { includedItems: true },
        orderBy: { createdAt: "desc" },
      });
      let mapped = rows.map(mapTicket);
      if (filters.soldOut !== undefined) {
        const avail = await this.getCatalogAvailability(filters.editionId);
        const map = new Map(avail.map((a) => [a.ticketTypeId, a]));
        mapped = mapped.filter((t) => {
          const sold = map.get(t.id)?.isSoldOut ?? false;
          return filters.soldOut ? sold : !sold;
        });
      }
      return mapped;
    },

    async getTicketType(ticketId) {
      const row = await prisma.clickatonTicketType.findUnique({
        where: { id: ticketId },
        include: { includedItems: true },
      });
      return row ? mapTicket(row) : null;
    },

    async ticketCodeExists(editionId, code, excludeId) {
      const row = await prisma.clickatonTicketType.findFirst({
        where: {
          editionId,
          code,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      return Boolean(row);
    },

    async createTicketType(data: CreateTicketTypeData) {
      await assertCompositionItems(data.editionId, data.items);
      try {
        const row = await prisma.clickatonTicketType.create({
          data: {
            editionId: data.editionId,
            venueId: data.venueId,
            name: data.name,
            description: data.description,
            code: data.code,
            priceAmount: data.priceAmount,
            currency: data.currency,
            capacity: data.capacity,
            holdMinutes: data.holdMinutes,
            isActive: data.isActive,
            salesStartAt: data.salesStartAt,
            salesEndAt: data.salesEndAt,
            includedItems: {
              create: data.items.map((i) => ({
                productId: i.productId,
                productVariantId: i.productVariantId ?? null,
                quantity: i.quantity,
                requiresVariantChoice: i.requiresVariantChoice,
              })),
            },
          },
          include: { includedItems: true },
        });
        return mapTicket(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async updateTicketType(ticketId, data: UpdateTicketTypeData) {
      try {
        const row = await prisma.clickatonTicketType.update({
          where: { id: ticketId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.code !== undefined ? { code: data.code } : {}),
            ...(data.priceAmount !== undefined ? { priceAmount: data.priceAmount } : {}),
            ...(data.currency !== undefined ? { currency: data.currency } : {}),
            ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
            ...(data.holdMinutes !== undefined ? { holdMinutes: data.holdMinutes } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.venueId !== undefined ? { venueId: data.venueId } : {}),
            ...(data.salesStartAt !== undefined ? { salesStartAt: data.salesStartAt } : {}),
            ...(data.salesEndAt !== undefined ? { salesEndAt: data.salesEndAt } : {}),
          },
          include: { includedItems: true },
        });
        return mapTicket(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async setTicketTypeActive(ticketId, isActive) {
      return this.updateTicketType(ticketId, { isActive });
    },

    async replaceTicketTypeItems(ticketId, items) {
      const existing = await prisma.clickatonTicketType.findUnique({
        where: { id: ticketId },
        select: { editionId: true },
      });
      if (!existing) throw new CatalogNotFoundError("Entrada", ticketId);
      await assertCompositionItems(existing.editionId, items);
      try {
        const row = await prisma.$transaction(async (tx) => {
          await tx.clickatonTicketTypeItem.deleteMany({ where: { ticketTypeId: ticketId } });
          return tx.clickatonTicketType.update({
            where: { id: ticketId },
            data: {
              includedItems: {
                create: items.map((i) => ({
                  productId: i.productId,
                  productVariantId: i.productVariantId ?? null,
                  quantity: i.quantity,
                  requiresVariantChoice: i.requiresVariantChoice,
                })),
              },
            },
            include: { includedItems: true },
          });
        });
        return mapTicket(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async duplicateTicketType(input) {
      const source = await this.getTicketType(input.sourceId);
      if (!source) throw new CatalogNotFoundError("Entrada", input.sourceId);
      return this.createTicketType({
        editionId: source.editionId,
        venueId: input.venueId === undefined ? source.venueId : input.venueId ?? null,
        name: input.name,
        description: source.description,
        code: input.code,
        priceAmount: source.priceAmount,
        currency: source.currency,
        capacity: source.capacity,
        holdMinutes: source.holdMinutes,
        isActive: input.isActive ?? false,
        salesStartAt: source.salesStartAt,
        salesEndAt: source.salesEndAt,
        items: source.items.map(
          ({ productId, productVariantId, quantity, requiresVariantChoice }) => ({
            productId,
            productVariantId,
            quantity,
            requiresVariantChoice,
          }),
        ),
      });
    },

    async getRegistrationUsage(ticketTypeId): Promise<RegistrationUsage> {
      const groups = await prisma.clickatonRegistration.groupBy({
        by: ["status"],
        where: { ticketTypeId },
        _count: { _all: true },
      });
      let draftCount = 0;
      let pendingPaymentCount = 0;
      let confirmedCount = 0;
      let otherActiveCount = 0;
      for (const g of groups) {
        const n = g._count._all;
        if (g.status === "DRAFT") draftCount = n;
        else if (g.status === "PENDING_PAYMENT") pendingPaymentCount = n;
        else if (g.status === "CONFIRMED") confirmedCount = n;
        else if (g.status === "WAITLISTED") otherActiveCount += n;
      }
      return {
        draftCount,
        pendingPaymentCount,
        confirmedCount,
        otherActiveCount,
        hasConfirmed: confirmedCount > 0,
        hasAny: draftCount + pendingPaymentCount + confirmedCount + otherActiveCount > 0,
      };
    },

    async getCatalogAvailability(editionId, ticketTypeIds) {
      const now = new Date();
      const tickets = await prisma.clickatonTicketType.findMany({
        where: {
          editionId,
          ...(ticketTypeIds?.length ? { id: { in: ticketTypeIds } } : {}),
        },
        select: {
          id: true,
          capacity: true,
          isActive: true,
          salesStartAt: true,
          salesEndAt: true,
        },
      });
      if (!tickets.length) return [];

      const ids = tickets.map((t) => t.id);
      const [confirmed, holds, waitlisted] = await Promise.all([
        prisma.clickatonRegistration.groupBy({
          by: ["ticketTypeId"],
          where: { ticketTypeId: { in: ids }, status: "CONFIRMED" },
          _count: { _all: true },
        }),
        prisma.clickatonCapacityHold.groupBy({
          by: ["ticketTypeId"],
          where: {
            ticketTypeId: { in: ids },
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
          _count: { _all: true },
        }),
        prisma.clickatonRegistration.groupBy({
          by: ["ticketTypeId"],
          where: { ticketTypeId: { in: ids }, status: "WAITLISTED" },
          _count: { _all: true },
        }),
      ]);

      const confMap = new Map(confirmed.map((c) => [c.ticketTypeId, c._count._all]));
      const holdMap = new Map(holds.map((h) => [h.ticketTypeId, h._count._all]));
      const waitMap = new Map(waitlisted.map((w) => [w.ticketTypeId, w._count._all]));

      return tickets.map((t) =>
        buildAvailability({
          ticketTypeId: t.id,
          capacity: t.capacity,
          confirmedCount: confMap.get(t.id) ?? 0,
          activeHoldCount: holdMap.get(t.id) ?? 0,
          waitlistedCount: waitMap.get(t.id) ?? 0,
          salesStartAt: t.salesStartAt,
          salesEndAt: t.salesEndAt,
          isActive: t.isActive,
          now,
        }),
      );
    },

    async listProducts(filters: ProductFilters) {
      const rows = await prisma.clickatonProduct.findMany({
        where: {
          editionId: filters.editionId,
          ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
          ...(filters.query
            ? {
                OR: [
                  { name: { contains: filters.query, mode: "insensitive" } },
                  { code: { contains: filters.query, mode: "insensitive" } },
                  { variants: { some: { sku: { contains: filters.query, mode: "insensitive" } } } },
                ],
              }
            : {}),
        },
        include: {
          variants: true,
          ticketItems: { select: { ticketTypeId: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      let mapped: ProductListItem[] = rows.map((p) => {
        const product = mapProduct(p);
        const stockTotal = product.variants.reduce((s, v) => s + v.stock, 0);
        const reservedTotal = product.variants.reduce((s, v) => s + v.reservedStock, 0);
        const ticketIds = new Set(p.ticketItems.map((i) => i.ticketTypeId));
        return {
          ...product,
          stockTotal,
          reservedTotal,
          availableStock: Math.max(0, stockTotal - reservedTotal),
          includedInTicketCount: ticketIds.size,
        };
      });
      if (filters.withVariants === true) mapped = mapped.filter((p) => p.variants.length > 0);
      if (filters.withVariants === false) mapped = mapped.filter((p) => p.variants.length === 0);
      if (filters.withStock === true) mapped = mapped.filter((p) => p.availableStock > 0);
      if (filters.withStock === false) mapped = mapped.filter((p) => p.availableStock <= 0);
      return mapped;
    },

    async getProduct(productId) {
      const row = await prisma.clickatonProduct.findUnique({
        where: { id: productId },
        include: { variants: true },
      });
      return row ? mapProduct(row) : null;
    },

    async productCodeExists(editionId, code, excludeId) {
      const row = await prisma.clickatonProduct.findFirst({
        where: {
          editionId,
          code,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      return Boolean(row);
    },

    async createProduct(data: CreateProductData) {
      try {
        const row = await prisma.clickatonProduct.create({
          data: {
            editionId: data.editionId,
            name: data.name,
            description: data.description,
            code: data.code,
            isActive: data.isActive,
          },
          include: { variants: true },
        });
        return mapProduct(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async updateProduct(productId, data: UpdateProductData) {
      try {
        const row = await prisma.clickatonProduct.update({
          where: { id: productId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.code !== undefined ? { code: data.code } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.primaryImageAssetId !== undefined
              ? { primaryImageAssetId: data.primaryImageAssetId }
              : {}),
            ...(data.sizeChartAssetId !== undefined
              ? { sizeChartAssetId: data.sizeChartAssetId }
              : {}),
            ...(data.sizeChartDescription !== undefined
              ? { sizeChartDescription: data.sizeChartDescription }
              : {}),
            ...(data.sizeChartInstructions !== undefined
              ? { sizeChartInstructions: data.sizeChartInstructions }
              : {}),
            ...(data.isStoreEnabled !== undefined ? { isStoreEnabled: data.isStoreEnabled } : {}),
            ...(data.storeStatus !== undefined
              ? { storeStatus: data.storeStatus as ProductRecord["storeStatus"] }
              : {}),
            ...(data.storeSlug !== undefined ? { storeSlug: data.storeSlug } : {}),
            ...(data.storeTitle !== undefined ? { storeTitle: data.storeTitle } : {}),
            ...(data.storeDescription !== undefined
              ? { storeDescription: data.storeDescription }
              : {}),
            ...(data.storePrice !== undefined ? { storePrice: data.storePrice } : {}),
            ...(data.compareAtPrice !== undefined ? { compareAtPrice: data.compareAtPrice } : {}),
            ...(data.requiresShipping !== undefined
              ? { requiresShipping: data.requiresShipping }
              : {}),
            ...(data.allowPickup !== undefined ? { allowPickup: data.allowPickup } : {}),
          },
          include: { variants: true },
        });
        return mapProduct(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async setProductActive(productId, isActive) {
      return this.updateProduct(productId, { isActive });
    },

    async getVariant(variantId) {
      const row = await prisma.clickatonProductVariant.findUnique({ where: { id: variantId } });
      return row ? mapVariant(row) : null;
    },

    async skuExists(sku, excludeId) {
      const row = await prisma.clickatonProductVariant.findFirst({
        where: { sku, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      return Boolean(row);
    },

    async createVariant(data: CreateVariantData) {
      try {
        const row = await prisma.clickatonProductVariant.create({
          data: {
            productId: data.productId,
            code: data.code,
            name: data.name,
            sku: data.sku,
            stock: data.stock,
            priceAmount: data.priceAmount,
            currency: data.currency,
            sortOrder: data.sortOrder ?? 100,
            isActive: data.isActive,
          },
        });
        return mapVariant(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async updateVariant(variantId, data) {
      try {
        const row = await prisma.clickatonProductVariant.update({
          where: { id: variantId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.code !== undefined ? { code: data.code } : {}),
            ...(data.sku !== undefined ? { sku: data.sku } : {}),
            ...(data.priceAmount !== undefined ? { priceAmount: data.priceAmount } : {}),
            ...(data.currency !== undefined ? { currency: data.currency } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.stock !== undefined ? { stock: data.stock } : {}),
          },
        });
        return mapVariant(row);
      } catch (e) {
        mapPrismaError(e);
      }
    },

    async setVariantActive(variantId, isActive) {
      return this.updateVariant(variantId, { isActive });
    },

    async setVariantStock(variantId, newStock) {
      const updated = await prisma.clickatonProductVariant.updateMany({
        where: { id: variantId, reservedStock: { lte: newStock } },
        data: { stock: newStock },
      });
      if (updated.count === 0) {
        const current = await prisma.clickatonProductVariant.findUnique({
          where: { id: variantId },
        });
        if (!current) throw new CatalogNotFoundError("Variante", variantId);
        throw new CatalogStockError(
          `Stock (${newStock}) no puede ser menor que reservedStock (${current.reservedStock}).`,
        );
      }
      const row = await prisma.clickatonProductVariant.findUniqueOrThrow({
        where: { id: variantId },
      });
      return mapVariant(row);
    },

    async getVariantStockView(variantId) {
      const row = await prisma.clickatonProductVariant.findUnique({ where: { id: variantId } });
      if (!row) return null;
      const now = new Date();
      const holds = await prisma.clickatonStockHold.aggregate({
        where: {
          productVariantId: variantId,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
        _sum: { quantity: true },
      });
      return buildVariantStockView({
        variantId,
        stock: row.stock,
        reservedStock: row.reservedStock,
        activeHoldQuantity: holds._sum.quantity ?? 0,
      });
    },

    assertCompositionItems,
  };
}
