import type {
  CatalogDeliveryType,
  CatalogProduct,
  CatalogProductCategory,
  CatalogProductComponent,
  CatalogProductImage,
  CatalogProductType,
} from "@/lib/prisma";
import {
  compositionSummaryOrFallback,
  type CompositionLine,
} from "@/lib/catalog-products/composition-summary";
import {
  resolveDigitalQuantityMode,
  type CatalogDigitalQuantityMode,
} from "@/lib/catalog-products/digital-quantity-mode";

export type CatalogProductComponentItem = {
  id: number;
  name: string;
  quantity: number;
  deliveryType: CatalogDeliveryType;
  sortOrder: number;
  notes: string;
  digitalQuantityMode: CatalogDigitalQuantityMode;
};

export type CatalogProductListItem = {
  id: number;
  name: string;
  type: CatalogProductType;
  description: string;
  basePriceCents: number;
  categoryId: number;
  categoryName: string;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  mockupUrl: string | null;
  updatedAt: string;
  components: CatalogProductComponentItem[];
  compositionSummary: string;
};

export function serializeCatalogProductComponent(
  row: CatalogProductComponent
): CatalogProductComponentItem {
  const digitalQuantityMode = resolveDigitalQuantityMode({
    deliveryType: row.deliveryType,
    notes: row.notes,
  });
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    deliveryType: row.deliveryType,
    sortOrder: row.sortOrder,
    notes: row.notes,
    digitalQuantityMode,
  };
}

export function serializeCatalogProduct(
  product: CatalogProduct & {
    category: Pick<CatalogProductCategory, "id" | "name">;
    images: Pick<CatalogProductImage, "publicUrl" | "role">[];
    components?: CatalogProductComponent[];
  }
): CatalogProductListItem {
  const mockup = product.images.find((i) => i.role === "MOCKUP") ?? product.images[0];
  const components = (product.components ?? []).map(serializeCatalogProductComponent);
  const lines: CompositionLine[] = components.map((c) => ({
    quantity: c.quantity,
    name: c.name,
    deliveryType: c.deliveryType,
    digitalQuantityMode: c.digitalQuantityMode,
  }));

  return {
    id: product.id,
    name: product.name,
    type: product.type,
    description: product.description,
    basePriceCents: product.basePriceCents,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    isActive: product.isActive,
    isArchived: product.isArchived,
    sortOrder: product.sortOrder,
    mockupUrl: mockup?.publicUrl ?? null,
    updatedAt: product.updatedAt.toISOString(),
    components,
    compositionSummary: compositionSummaryOrFallback(product.type, lines),
  };
}

/** @deprecated Preferir CATALOG_PRODUCT_TYPE_DISPLAY en UI */
export const CATALOG_PRODUCT_TYPE_LABELS: Record<CatalogProductType, string> = {
  SIMPLE: "Producto",
  PACK: "Pack",
  COMBO: "Combo",
};

export { CATALOG_PRODUCT_TYPE_DISPLAY } from "./catalog-product-visual";
