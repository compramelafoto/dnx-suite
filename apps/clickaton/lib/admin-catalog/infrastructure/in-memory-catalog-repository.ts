import { randomBytes } from "node:crypto";
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
  CreateTicketTypeData,
  CreateVariantData,
  UpdateTicketTypeData,
} from "../domain/repository";
import type {
  EditionRef,
  ProductFilters,
  ProductListItem,
  ProductRecord,
  ProductVariantRecord,
  RegistrationUsage,
  TicketTypeFilters,
  TicketTypeItemInput,
  TicketTypeItemRecord,
  TicketTypeRecord,
  VenueRef,
} from "../domain/types";

function id(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export type InMemoryCatalogStore = {
  editions: Map<string, EditionRef>;
  venues: Map<string, VenueRef>;
  tickets: Map<string, TicketTypeRecord>;
  products: Map<string, ProductRecord>;
  /** registration counts by ticketTypeId */
  usage: Map<string, RegistrationUsage>;
  /** active capacity holds: ticketTypeId -> count (non-expired) */
  activeCapacityHolds: Map<string, number>;
  waitlisted: Map<string, number>;
  /** active stock hold qty by variantId */
  activeStockHolds: Map<string, number>;
};

export function createInMemoryCatalogStore(): InMemoryCatalogStore {
  return {
    editions: new Map(),
    venues: new Map(),
    tickets: new Map(),
    products: new Map(),
    usage: new Map(),
    activeCapacityHolds: new Map(),
    waitlisted: new Map(),
    activeStockHolds: new Map(),
  };
}

function defaultUsage(): RegistrationUsage {
  return {
    draftCount: 0,
    pendingPaymentCount: 0,
    confirmedCount: 0,
    otherActiveCount: 0,
    hasConfirmed: false,
    hasAny: false,
  };
}

export function createInMemoryCatalogRepository(
  store: InMemoryCatalogStore,
): ClickatonAdminCatalogRepository {
  function getVariantInternal(variantId: string): ProductVariantRecord | null {
    for (const p of store.products.values()) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return v;
    }
    return null;
  }

  async function assertCompositionItems(editionId: string, items: TicketTypeItemInput[]) {
    for (const item of items) {
      const product = store.products.get(item.productId);
      if (!product || product.editionId !== editionId) {
        throw new CatalogEditionMismatchError("Producto fuera de la edición.");
      }
      if (!product.isActive) {
        throw new CatalogValidationError({
          items: `Producto inactivo: ${product.code}`,
        });
      }
      if (item.productVariantId) {
        const variant = product.variants.find((v) => v.id === item.productVariantId);
        if (!variant) throw new CatalogEditionMismatchError("Variante no pertenece al producto.");
        if (!variant.isActive) {
          throw new CatalogValidationError({ items: `Variante inactiva: ${variant.code}` });
        }
      }
    }
  }

  return {
    async getEdition(editionId) {
      return store.editions.get(editionId) ?? null;
    },
    async getVenue(venueId) {
      return store.venues.get(venueId) ?? null;
    },

    async listTicketTypes(filters: TicketTypeFilters) {
      let rows = [...store.tickets.values()].filter((t) => t.editionId === filters.editionId);
      if (filters.venueId !== undefined) {
        rows = rows.filter((t) => t.venueId === filters.venueId);
      }
      if (filters.isActive !== undefined) {
        rows = rows.filter((t) => t.isActive === filters.isActive);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        rows = rows.filter(
          (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q),
        );
      }
      if (filters.soldOut !== undefined) {
        const avail = await this.getCatalogAvailability(filters.editionId);
        const map = new Map(avail.map((a) => [a.ticketTypeId, a]));
        rows = rows.filter((t) => {
          const a = map.get(t.id);
          const sold = a?.isSoldOut ?? false;
          return filters.soldOut ? sold : !sold;
        });
      }
      return rows.map((r) => structuredClone(r));
    },

    async getTicketType(ticketId) {
      const t = store.tickets.get(ticketId);
      return t ? structuredClone(t) : null;
    },

    async ticketCodeExists(editionId, code, excludeId) {
      return [...store.tickets.values()].some(
        (t) => t.editionId === editionId && t.code === code && t.id !== excludeId,
      );
    },

    async createTicketType(data: CreateTicketTypeData) {
      await assertCompositionItems(data.editionId, data.items);
      const now = new Date();
      const items: TicketTypeItemRecord[] = data.items.map((i) => ({
        id: id("tti"),
        ...i,
      }));
      const row: TicketTypeRecord = {
        id: id("tt"),
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
        createdAt: now,
        updatedAt: now,
        items,
      };
      store.tickets.set(row.id, row);
      store.usage.set(row.id, defaultUsage());
      return structuredClone(row);
    },

    async updateTicketType(ticketId, data: UpdateTicketTypeData) {
      const row = store.tickets.get(ticketId);
      if (!row) throw new CatalogNotFoundError("Entrada", ticketId);
      Object.assign(row, data, { updatedAt: new Date() });
      return structuredClone(row);
    },

    async setTicketTypeActive(ticketId, isActive) {
      return this.updateTicketType(ticketId, { isActive });
    },

    async replaceTicketTypeItems(ticketId, items) {
      const row = store.tickets.get(ticketId);
      if (!row) throw new CatalogNotFoundError("Entrada", ticketId);
      await assertCompositionItems(row.editionId, items);
      row.items = items.map((i) => ({ id: id("tti"), ...i }));
      row.updatedAt = new Date();
      return structuredClone(row);
    },

    async duplicateTicketType(input) {
      const source = store.tickets.get(input.sourceId);
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
        items: source.items.map(({ productId, productVariantId, quantity, requiresVariantChoice }) => ({
          productId,
          productVariantId,
          quantity,
          requiresVariantChoice,
        })),
      });
    },

    async getRegistrationUsage(ticketTypeId) {
      return structuredClone(store.usage.get(ticketTypeId) ?? defaultUsage());
    },

    async getCatalogAvailability(editionId, ticketTypeIds) {
      const tickets = [...store.tickets.values()].filter(
        (t) =>
          t.editionId === editionId &&
          (!ticketTypeIds?.length || ticketTypeIds.includes(t.id)),
      );
      return tickets.map((t) => {
        const usage = store.usage.get(t.id) ?? defaultUsage();
        return buildAvailability({
          ticketTypeId: t.id,
          capacity: t.capacity,
          confirmedCount: usage.confirmedCount,
          activeHoldCount: store.activeCapacityHolds.get(t.id) ?? 0,
          waitlistedCount: store.waitlisted.get(t.id) ?? 0,
          salesStartAt: t.salesStartAt,
          salesEndAt: t.salesEndAt,
          isActive: t.isActive,
        });
      });
    },

    async listProducts(filters: ProductFilters) {
      let rows = [...store.products.values()].filter((p) => p.editionId === filters.editionId);
      if (filters.isActive !== undefined) rows = rows.filter((p) => p.isActive === filters.isActive);
      if (filters.withVariants === true) rows = rows.filter((p) => p.variants.length > 0);
      if (filters.withVariants === false) rows = rows.filter((p) => p.variants.length === 0);
      if (filters.query) {
        const q = filters.query.toLowerCase();
        rows = rows.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.variants.some((v) => v.sku.toLowerCase().includes(q)),
        );
      }
      const mapped: ProductListItem[] = rows.map((p) => {
        const stockTotal = p.variants.reduce((s, v) => s + v.stock, 0);
        const reservedTotal = p.variants.reduce((s, v) => s + v.reservedStock, 0);
        const availableStock = Math.max(0, stockTotal - reservedTotal);
        const includedInTicketCount = [...store.tickets.values()].filter((t) =>
          t.items.some((i) => i.productId === p.id),
        ).length;
        return {
          ...structuredClone(p),
          stockTotal,
          reservedTotal,
          availableStock,
          includedInTicketCount,
        };
      });
      if (filters.withStock === true) return mapped.filter((p) => p.availableStock > 0);
      if (filters.withStock === false) return mapped.filter((p) => p.availableStock <= 0);
      return mapped;
    },

    async getProduct(productId) {
      const p = store.products.get(productId);
      return p ? structuredClone(p) : null;
    },

    async productCodeExists(editionId, code, excludeId) {
      return [...store.products.values()].some(
        (p) => p.editionId === editionId && p.code === code && p.id !== excludeId,
      );
    },

    async createProduct(data: CreateProductData) {
      const now = new Date();
      const row: ProductRecord = {
        id: id("prod"),
        editionId: data.editionId,
        name: data.name,
        description: data.description,
        code: data.code,
        isActive: data.isActive,
        createdAt: now,
        updatedAt: now,
        variants: [],
      };
      store.products.set(row.id, row);
      return structuredClone(row);
    },

    async updateProduct(productId, data) {
      const row = store.products.get(productId);
      if (!row) throw new CatalogNotFoundError("Producto", productId);
      Object.assign(row, data, { updatedAt: new Date() });
      return structuredClone(row);
    },

    async setProductActive(productId, isActive) {
      return this.updateProduct(productId, { isActive });
    },

    async getVariant(variantId) {
      const v = getVariantInternal(variantId);
      return v ? structuredClone(v) : null;
    },

    async skuExists(sku, excludeId) {
      for (const p of store.products.values()) {
        if (p.variants.some((v) => v.sku === sku && v.id !== excludeId)) return true;
      }
      return false;
    },

    async createVariant(data: CreateVariantData) {
      const product = store.products.get(data.productId);
      if (!product) throw new CatalogNotFoundError("Producto", data.productId);
      if (await this.skuExists(data.sku)) throw new CatalogDuplicateSkuError(data.sku);
      if (product.variants.some((v) => v.code === data.code)) {
        throw new CatalogDuplicateCodeError("producto", data.code);
      }
      const now = new Date();
      const row: ProductVariantRecord = {
        id: id("var"),
        productId: data.productId,
        code: data.code,
        name: data.name,
        sku: data.sku,
        stock: data.stock,
        reservedStock: 0,
        priceAmount: data.priceAmount,
        currency: data.currency,
        isActive: data.isActive,
        createdAt: now,
        updatedAt: now,
      };
      product.variants.push(row);
      product.updatedAt = now;
      return structuredClone(row);
    },

    async updateVariant(variantId, data) {
      const product = [...store.products.values()].find((p) =>
        p.variants.some((v) => v.id === variantId),
      );
      if (!product) throw new CatalogNotFoundError("Variante", variantId);
      const row = product.variants.find((v) => v.id === variantId)!;
      Object.assign(row, data, { updatedAt: new Date() });
      return structuredClone(row);
    },

    async setVariantActive(variantId, isActive) {
      return this.updateVariant(variantId, { isActive });
    },

    async setVariantStock(variantId, newStock) {
      const row = getVariantInternal(variantId);
      if (!row) throw new CatalogNotFoundError("Variante", variantId);
      if (newStock < row.reservedStock) {
        throw new CatalogStockError("Stock menor que reservedStock.");
      }
      row.stock = newStock;
      row.updatedAt = new Date();
      return structuredClone(row);
    },

    async getVariantStockView(variantId) {
      const row = getVariantInternal(variantId);
      if (!row) return null;
      return buildVariantStockView({
        variantId,
        stock: row.stock,
        reservedStock: row.reservedStock,
        activeHoldQuantity: store.activeStockHolds.get(variantId) ?? 0,
      });
    },

    assertCompositionItems,
  };
}

/** Helpers de fixture para tests. */
export function seedEdition(store: InMemoryCatalogStore, edition: EditionRef) {
  store.editions.set(edition.id, edition);
}
export function seedVenue(store: InMemoryCatalogStore, venue: VenueRef) {
  store.venues.set(venue.id, venue);
}
export function setUsage(store: InMemoryCatalogStore, ticketTypeId: string, usage: Partial<RegistrationUsage>) {
  const base = store.usage.get(ticketTypeId) ?? defaultUsage();
  const next = { ...base, ...usage };
  next.hasConfirmed = next.confirmedCount > 0;
  next.hasAny =
    next.draftCount + next.pendingPaymentCount + next.confirmedCount + next.otherActiveCount > 0;
  store.usage.set(ticketTypeId, next);
}
