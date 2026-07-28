/** Tipos de dominio — productos por fase + tienda (Etapa 8B). */

export type RegistrationItemSourceType = "TICKET_BASE" | "PRICE_PHASE" | "STORE_PURCHASE";

export type ProductMediaType =
  | "PRIMARY"
  | "GALLERY"
  | "SIZE_CHART"
  | "DETAIL"
  | "PACKAGING"
  | "IN_USE";

export type ProductStoreStatus =
  | "DRAFT"
  | "ACTIVE"
  | "OUT_OF_STOCK"
  | "HIDDEN"
  | "ARCHIVED";

export type InventoryMovementType =
  | "INITIAL_STOCK"
  | "ADMIN_ADJUSTMENT"
  | "REGISTRATION_HOLD"
  | "REGISTRATION_CONFIRMED"
  | "REGISTRATION_RELEASED"
  | "STORE_HOLD"
  | "STORE_SALE"
  | "STORE_RELEASED"
  | "RETURN"
  | "DAMAGED"
  | "GIFT";

export type IncludedProductVariantView = {
  id: string;
  code?: string;
  name: string;
  sku: string;
  availableStock: number;
  isActive: boolean;
  sortOrder?: number;
};

export type IncludedProductConfig = {
  /** Soft ref origen ticket (null si solo fase). */
  ticketTypeItemId: string | null;
  /** Soft ref origen fase (null si solo ticket). */
  pricePhaseItemId: string | null;
  sourceType: "TICKET_BASE" | "PRICE_PHASE";
  productId: string;
  productName: string;
  productDescription: string | null;
  displayTitle: string | null;
  displayDescription: string | null;
  quantity: number;
  requiresVariantChoice: boolean;
  fulfillmentRequired: boolean;
  primaryImageAssetId: string | null;
  primaryImageUrl: string | null;
  sizeChartAssetId: string | null;
  sizeChartUrl: string | null;
  sizeChartDescription: string | null;
  sizeChartInstructions: string | null;
  gallery: Array<{
    assetId: string;
    url: string | null;
    altText: string | null;
    caption: string | null;
    sortOrder: number;
  }>;
  fixedVariant: { id: string; name: string; sku: string } | null;
  variants: IncludedProductVariantView[];
};

export type PricePhaseItemInput = {
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  sortOrder?: number;
  isIncluded?: boolean;
  stockLimit?: number | null;
  fulfillmentRequired?: boolean;
  displayTitle?: string | null;
  displayDescription?: string | null;
};

export type ResolveIncludedItemsErrorCode =
  | "DUPLICATE_PRODUCT_TICKET_AND_PHASE"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_ARCHIVED"
  | "VARIANT_REQUIRED_WITHOUT_VARIANTS"
  | "INVALID_QUANTITY";
