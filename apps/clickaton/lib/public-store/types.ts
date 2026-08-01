/**
 * Tipos públicos del storefront TIENDA (solo lectura / vitrina).
 * Neutros respecto a Prisma ClickatonProduct — aptos para UI reutilizable.
 */

import type { StoreAvailabilityView } from "@/lib/public-store/availability";

export type StoreProductCardDto = {
  id: string;
  /** Slug canónico para `/tienda/[storeSlug]`. */
  storeSlug: string;
  /** Título comercial (storeTitle) o nombre de catálogo. */
  name: string;
  /** Descripción corta para la card (storeDescription o description). */
  shortDescription: string | null;
  /** Precio tienda en minor units (nunca precio de inscripción). */
  storePrice: number;
  storeCurrency: string;
  /** Precio formateado para UI. */
  priceLabel: string;
  /** URL pública de imagen principal, o null si no hay asset. */
  primaryImageUrl: string | null;
  imageAlt: string;
  /** Edición del producto (relacionados / resolución). */
  editionId?: string;
};

export type PublicStoreImage = {
  id: string;
  url: string;
  alt: string;
  mediaType: string;
  sortOrder: number;
};

export type PublicStoreVariant = {
  id: string;
  /** Nombre visible (talle / opción). */
  name: string;
  code: string;
  /** SKU interno; opcional en UI pública. */
  sku: string | null;
  sortOrder: number;
  availableStock: number;
  availability: StoreAvailabilityView;
  /** false → no seleccionable (agotado o inactivo filtrado). */
  selectable: boolean;
};

/**
 * View model público de ficha de producto.
 * Los componentes visuales consumen este DTO — no Prisma.
 */
export type PublicStoreProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  currency: string;
  priceLabel: string;
  status: "ACTIVE" | "OUT_OF_STOCK";
  badge: string;
  editionId: string;
  images: PublicStoreImage[];
  primaryImage: PublicStoreImage | null;
  variants: PublicStoreVariant[];
  availability: StoreAvailabilityView;
  /**
   * Variante preseleccionada solo si hay exactamente una seleccionable.
   * null = el usuario debe elegir (evita compra equivocada).
   */
  initialSelectedVariantId: string | null;
};
