import type {
  AvailabilityRecord,
  EditionId,
  EditionRef,
  ProductFilters,
  ProductId,
  ProductListItem,
  ProductRecord,
  ProductStoreStatus,
  ProductVariantRecord,
  RegistrationUsage,
  TicketTypeFilters,
  TicketTypeId,
  TicketTypeItemInput,
  TicketTypeRecord,
  VariantId,
  VariantStockView,
  VenueId,
  VenueRef,
} from "./types";

export type CreateTicketTypeData = {
  editionId: EditionId;
  venueId: VenueId | null;
  name: string;
  description: string | null;
  code: string;
  priceAmount: number;
  currency: "ARS";
  capacity: number | null;
  holdMinutes: number;
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  items: TicketTypeItemInput[];
};

export type UpdateTicketTypeData = Partial<
  Omit<CreateTicketTypeData, "editionId" | "items" | "code">
> & {
  code?: string;
};

export type CreateProductData = {
  editionId: EditionId;
  name: string;
  description: string | null;
  code: string;
  isActive: boolean;
};

export type UpdateProductData = Partial<Omit<CreateProductData, "editionId">> & {
  primaryImageAssetId?: string | null;
  sizeChartAssetId?: string | null;
  sizeChartDescription?: string | null;
  sizeChartInstructions?: string | null;
  isStoreEnabled?: boolean;
  storeStatus?: ProductStoreStatus;
  storeSlug?: string | null;
  storeTitle?: string | null;
  storeDescription?: string | null;
  storePrice?: number | null;
  compareAtPrice?: number | null;
  requiresShipping?: boolean;
  allowPickup?: boolean;
};

export type CreateVariantData = {
  productId: ProductId;
  code: string;
  name: string;
  sku: string;
  stock: number;
  priceAmount: number | null;
  currency: "ARS" | null;
  sortOrder?: number;
  isActive: boolean;
};

/**
 * Puerto compuesto del catálogo admin.
 * Implementaciones: in-memory (tests) y Prisma (prod).
 */
export interface ClickatonAdminCatalogRepository {
  getEdition(editionId: EditionId): Promise<EditionRef | null>;
  getVenue(venueId: VenueId): Promise<VenueRef | null>;

  listTicketTypes(filters: TicketTypeFilters): Promise<TicketTypeRecord[]>;
  getTicketType(id: TicketTypeId): Promise<TicketTypeRecord | null>;
  ticketCodeExists(editionId: EditionId, code: string, excludeId?: TicketTypeId): Promise<boolean>;
  createTicketType(data: CreateTicketTypeData): Promise<TicketTypeRecord>;
  updateTicketType(id: TicketTypeId, data: UpdateTicketTypeData): Promise<TicketTypeRecord>;
  setTicketTypeActive(id: TicketTypeId, isActive: boolean): Promise<TicketTypeRecord>;
  replaceTicketTypeItems(
    id: TicketTypeId,
    items: TicketTypeItemInput[],
  ): Promise<TicketTypeRecord>;
  duplicateTicketType(input: {
    sourceId: TicketTypeId;
    code: string;
    name: string;
    venueId?: VenueId | null;
    isActive?: boolean;
  }): Promise<TicketTypeRecord>;

  getRegistrationUsage(ticketTypeId: TicketTypeId): Promise<RegistrationUsage>;
  getCatalogAvailability(
    editionId: EditionId,
    ticketTypeIds?: TicketTypeId[],
  ): Promise<AvailabilityRecord[]>;

  listProducts(filters: ProductFilters): Promise<ProductListItem[]>;
  getProduct(id: ProductId): Promise<ProductRecord | null>;
  productCodeExists(editionId: EditionId, code: string, excludeId?: ProductId): Promise<boolean>;
  createProduct(data: CreateProductData): Promise<ProductRecord>;
  updateProduct(
    id: ProductId,
    data: UpdateProductData,
  ): Promise<ProductRecord>;
  setProductActive(id: ProductId, isActive: boolean): Promise<ProductRecord>;

  getVariant(id: VariantId): Promise<ProductVariantRecord | null>;
  skuExists(sku: string, excludeId?: VariantId): Promise<boolean>;
  createVariant(data: CreateVariantData): Promise<ProductVariantRecord>;
  updateVariant(
    id: VariantId,
    data: Partial<Omit<CreateVariantData, "productId">>,
  ): Promise<ProductVariantRecord>;
  setVariantActive(id: VariantId, isActive: boolean): Promise<ProductVariantRecord>;
  /**
   * Set absolute stock if current reservedStock <= newStock.
   * Uses conditional update for concurrency.
   */
  setVariantStock(id: VariantId, newStock: number): Promise<ProductVariantRecord>;
  getVariantStockView(id: VariantId): Promise<VariantStockView | null>;

  /** Validate product/variant belong to edition (for composition). */
  assertCompositionItems(editionId: EditionId, items: TicketTypeItemInput[]): Promise<void>;
}
