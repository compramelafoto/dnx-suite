/**
 * Lectura pública de ficha de producto TIENDA.
 * Server-only. Sin writes, holds ni ledger.
 */

import "server-only";

import { cache } from "react";
import { prisma } from "@repo/db";
import { storePageContent } from "@/content/store";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { mapPublicStoreProductDetail, mapStoreProductCard } from "@/lib/public-store/map-store-product";
import { pickStoreSlugWinner } from "@/lib/public-store/resolve-store-slug";
import type { PublicStoreProductDetail, StoreProductCardDto } from "@/lib/public-store/types";
import { STOREFRONT_VISIBLE_STATUS_LIST } from "@/lib/public-store/visibility";

const publicProductWhere = {
  isActive: true as const,
  isStoreEnabled: true as const,
  storeStatus: { in: STOREFRONT_VISIBLE_STATUS_LIST },
  storeSlug: { not: null },
  storePrice: { not: null },
};

async function loadAssetUrlMap(assetIds: string[]): Promise<Map<string, string>> {
  const imageUrlByAssetId = new Map<string, string>();
  const unique = [...new Set(assetIds.filter(Boolean))];
  if (unique.length === 0) return imageUrlByAssetId;
  const assets = await prisma.dnxMediaAsset.findMany({
    where: { id: { in: unique } },
    select: { id: true, publicUrl: true },
  });
  for (const asset of assets) {
    const url = asset.publicUrl?.trim();
    if (url) imageUrlByAssetId.set(asset.id, url);
  }
  return imageUrlByAssetId;
}

/**
 * Detalle público por storeSlug.
 * Usa React cache() para compartir entre generateMetadata y page.
 * - null → no público / no existe (tratar como notFound)
 * - throw → error operativo de DB (no convertir a 404)
 */
export const getPublicStoreProductBySlug = cache(
  async (storeSlug: string): Promise<PublicStoreProductDetail | null> => {
    const slug = storeSlug?.trim() ?? "";
    if (!slug) return null;

    const candidates = await prisma.clickatonProduct.findMany({
      where: {
        ...publicProductWhere,
        storeSlug: { equals: slug, mode: "insensitive" },
      },
      select: {
        id: true,
        storeSlug: true,
        updatedAt: true,
        edition: {
          select: {
            isPublished: true,
            registrationEnabled: true,
            status: true,
          },
        },
      },
    });

    const winnerMeta = pickStoreSlugWinner(
      candidates.map((c) => ({
        id: c.id,
        storeSlug: c.storeSlug ?? slug,
        updatedAt: c.updatedAt,
        edition: c.edition,
      })),
    );
    if (!winnerMeta) return null;

    const row = await prisma.clickatonProduct.findUnique({
      where: { id: winnerMeta.id },
      select: {
        id: true,
        editionId: true,
        name: true,
        description: true,
        storeSlug: true,
        storeTitle: true,
        storeDescription: true,
        storePrice: true,
        storeCurrency: true,
        storeStatus: true,
        primaryImageAssetId: true,
        isActive: true,
        isStoreEnabled: true,
        variants: {
          select: {
            id: true,
            code: true,
            name: true,
            sku: true,
            stock: true,
            reservedStock: true,
            sortOrder: true,
            isActive: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        media: {
          select: {
            id: true,
            assetId: true,
            mediaType: true,
            sortOrder: true,
            altText: true,
            status: true,
          },
          orderBy: [{ sortOrder: "asc" }],
        },
      },
    });

    if (!row || !row.storeSlug || row.storePrice == null) return null;
    if (!row.isActive || !row.isStoreEnabled) return null;
    if (row.storeStatus !== "ACTIVE" && row.storeStatus !== "OUT_OF_STOCK") return null;

    const assetIds = [
      ...(row.primaryImageAssetId ? [row.primaryImageAssetId] : []),
      ...row.media.map((m) => m.assetId),
    ];
    const urlByAssetId = await loadAssetUrlMap(assetIds);

    return mapPublicStoreProductDetail({
      row: {
        id: row.id,
        editionId: row.editionId,
        name: row.name,
        description: row.description,
        storeSlug: row.storeSlug,
        storeTitle: row.storeTitle,
        storeDescription: row.storeDescription,
        storePrice: row.storePrice,
        storeCurrency: row.storeCurrency,
        storeStatus: row.storeStatus,
        primaryImageAssetId: row.primaryImageAssetId,
        variants: row.variants,
        media: row.media,
      },
      urlByAssetId,
      priceLabel: formatPublicPrice(row.storePrice, row.storeCurrency || "ARS"),
      badge: storePageContent.badge,
    });
  },
);

/**
 * Hasta 4 productos públicos relacionados (excluye el actual).
 * Prioridad: misma edición → resto del catálogo tienda.
 * Una query de productos + una batch de assets.
 */
export async function listRelatedStoreProducts(input: {
  productId: string;
  editionId: string;
  limit?: number;
}): Promise<StoreProductCardDto[]> {
  const limit = Math.min(Math.max(input.limit ?? 4, 1), 8);

  const rows = await prisma.clickatonProduct.findMany({
    where: {
      ...publicProductWhere,
      id: { not: input.productId },
    },
    orderBy: [{ storeSortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      editionId: true,
      name: true,
      description: true,
      storeSlug: true,
      storeTitle: true,
      storeDescription: true,
      storePrice: true,
      storeCurrency: true,
      storeSortOrder: true,
      primaryImageAssetId: true,
      updatedAt: true,
      edition: {
        select: {
          isPublished: true,
          registrationEnabled: true,
          status: true,
        },
      },
    },
    take: 40,
  });

  const sameEdition = rows.filter((r) => r.editionId === input.editionId);
  const others = rows.filter((r) => r.editionId !== input.editionId);
  const ordered = [...sameEdition, ...others].slice(0, limit);

  const urlByAssetId = await loadAssetUrlMap(
    ordered
      .map((r) => r.primaryImageAssetId)
      .filter((id): id is string => Boolean(id)),
  );

  const out: StoreProductCardDto[] = [];
  for (const r of ordered) {
    if (!r.storeSlug || r.storePrice == null) continue;
    out.push(
      mapStoreProductCard({
        id: r.id,
        editionId: r.editionId,
        name: r.name,
        description: r.description,
        storeSlug: r.storeSlug,
        storeTitle: r.storeTitle,
        storeDescription: r.storeDescription,
        storePrice: r.storePrice,
        storeCurrency: r.storeCurrency,
        primaryImageUrl: r.primaryImageAssetId
          ? (urlByAssetId.get(r.primaryImageAssetId) ?? null)
          : null,
        priceLabel: formatPublicPrice(r.storePrice, r.storeCurrency || "ARS"),
      }),
    );
  }
  return out;
}
