/**
 * Mapeo puro Prisma-row → PublicStoreProductDetail / cards.
 * Sin I/O — testeable sin DB.
 */

import {
  availabilityFromStock,
  productAvailabilityFromVariants,
  publicAvailableStock,
} from "@/lib/public-store/availability";
import { toStoreShortDescription } from "@/lib/public-store/visibility";
import type {
  PublicStoreImage,
  PublicStoreProductDetail,
  PublicStoreVariant,
  StoreProductCardDto,
} from "@/lib/public-store/types";

export type RawStoreMediaRow = {
  id: string;
  assetId: string;
  mediaType: string;
  sortOrder: number;
  altText: string | null;
  status: string;
};

export type RawStoreVariantRow = {
  id: string;
  code: string;
  name: string;
  sku: string;
  stock: number;
  reservedStock: number;
  sortOrder: number;
  isActive: boolean;
};

export type RawStoreProductDetailRow = {
  id: string;
  editionId: string;
  name: string;
  description: string | null;
  storeSlug: string;
  storeTitle: string | null;
  storeDescription: string | null;
  storePrice: number;
  storeCurrency: string;
  storeStatus: string;
  primaryImageAssetId: string | null;
  variants: RawStoreVariantRow[];
  media: RawStoreMediaRow[];
};

export function mapStoreProductCard(input: {
  id: string;
  editionId?: string;
  name: string;
  description: string | null;
  storeSlug: string;
  storeTitle: string | null;
  storeDescription: string | null;
  storePrice: number;
  storeCurrency: string;
  primaryImageUrl: string | null;
  priceLabel: string;
}): StoreProductCardDto {
  const displayName = (input.storeTitle?.trim() || input.name).trim();
  return {
    id: input.id,
    storeSlug: input.storeSlug.trim(),
    name: displayName,
    shortDescription: toStoreShortDescription(
      input.storeDescription,
      input.description,
    ),
    storePrice: input.storePrice,
    storeCurrency: input.storeCurrency || "ARS",
    priceLabel: input.priceLabel,
    primaryImageUrl: input.primaryImageUrl,
    imageAlt: displayName,
    editionId: input.editionId,
  };
}

function buildImages(input: {
  productName: string;
  primaryImageAssetId: string | null;
  media: RawStoreMediaRow[];
  urlByAssetId: Map<string, string>;
}): PublicStoreImage[] {
  const images: PublicStoreImage[] = [];
  const seenUrls = new Set<string>();

  const push = (row: {
    id: string;
    assetId: string;
    mediaType: string;
    sortOrder: number;
    altText: string | null;
  }) => {
    const url = input.urlByAssetId.get(row.assetId)?.trim();
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    images.push({
      id: row.id,
      url,
      alt: row.altText?.trim() || input.productName,
      mediaType: row.mediaType,
      sortOrder: row.sortOrder,
    });
  };

  const activeMedia = input.media
    .filter((m) => (m.status || "ACTIVE").toUpperCase() === "ACTIVE")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const primaryMedia = activeMedia.find((m) => m.mediaType === "PRIMARY");
  if (primaryMedia) {
    push(primaryMedia);
  } else if (input.primaryImageAssetId) {
    const url = input.urlByAssetId.get(input.primaryImageAssetId)?.trim();
    if (url) {
      seenUrls.add(url);
      images.push({
        id: `primary-${input.primaryImageAssetId}`,
        url,
        alt: input.productName,
        mediaType: "PRIMARY",
        sortOrder: 0,
      });
    }
  }

  for (const m of activeMedia) {
    if (m.mediaType === "PRIMARY") continue;
    // SIZE_CHART puede ir a la galería como secundaria (útil en remeras).
    push(m);
  }

  return images.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function mapVariants(rows: RawStoreVariantRow[]): PublicStoreVariant[] {
  return rows
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"))
    .map((v) => {
      const availableStock = publicAvailableStock(v.stock, v.reservedStock);
      const availability = availabilityFromStock(availableStock);
      const name = (v.name || v.code || "Opción").trim() || "Opción";
      return {
        id: v.id,
        name,
        code: v.code,
        sku: v.sku?.trim() || null,
        sortOrder: v.sortOrder,
        availableStock,
        availability,
        selectable: availableStock > 0,
      };
    });
}

export function mapPublicStoreProductDetail(input: {
  row: RawStoreProductDetailRow;
  urlByAssetId: Map<string, string>;
  priceLabel: string;
  badge: string;
}): PublicStoreProductDetail | null {
  const { row } = input;
  const slug = row.storeSlug?.trim() ?? "";
  if (!slug) return null;
  if (row.storePrice == null || !Number.isFinite(row.storePrice) || row.storePrice < 0) {
    return null;
  }
  if (row.storeStatus !== "ACTIVE" && row.storeStatus !== "OUT_OF_STOCK") {
    return null;
  }

  const name = (row.storeTitle?.trim() || row.name).trim();
  if (!name) return null;

  const shortDescription = toStoreShortDescription(
    row.storeDescription,
    row.description,
    160,
  );
  const description =
    row.storeDescription?.trim() || row.description?.trim() || null;

  const variants = mapVariants(row.variants);
  const availability = productAvailabilityFromVariants({
    storeStatus: row.storeStatus,
    variantAvailableStocks: variants.map((v) => v.availableStock),
  });

  const images = buildImages({
    productName: name,
    primaryImageAssetId: row.primaryImageAssetId,
    media: row.media,
    urlByAssetId: input.urlByAssetId,
  });

  const selectable = variants.filter((v) => v.selectable);
  const initialSelectedVariantId =
    selectable.length === 1 ? selectable[0]!.id : null;

  return {
    id: row.id,
    slug,
    name,
    shortDescription,
    description,
    price: row.storePrice,
    currency: row.storeCurrency || "ARS",
    priceLabel: input.priceLabel,
    status: row.storeStatus,
    badge: input.badge,
    editionId: row.editionId,
    images,
    primaryImage: images[0] ?? null,
    variants,
    availability,
    initialSelectedVariantId,
  };
}
