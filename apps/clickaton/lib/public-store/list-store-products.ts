/**
 * Listado público de productos habilitados para TIENDA.
 * Una query de productos + una batch de assets (sin N+1).
 * Deduplicación de storeSlug alineada con getPublicStoreProductBySlug.
 */

import "server-only";

import { prisma } from "@repo/db";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { mapStoreProductCard } from "@/lib/public-store/map-store-product";
import { pickStoreSlugWinner } from "@/lib/public-store/resolve-store-slug";
import type { StoreProductCardDto } from "@/lib/public-store/types";
import { STOREFRONT_VISIBLE_STATUS_LIST } from "@/lib/public-store/visibility";

/**
 * Productos listos para vitrina pública.
 * Filtros: isActive + isStoreEnabled + storeStatus visible + storeSlug + storePrice.
 * Ante error de DB: lista vacía (la vitrina no debe romper).
 */
export async function listPublicStoreProducts(): Promise<StoreProductCardDto[]> {
  try {
    const rows = await prisma.clickatonProduct.findMany({
      where: {
        isActive: true,
        isStoreEnabled: true,
        storeStatus: { in: STOREFRONT_VISIBLE_STATUS_LIST },
        storeSlug: { not: null },
        storePrice: { not: null },
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
    });

    const bySlug = new Map<string, typeof rows>();
    for (const row of rows) {
      const slug = row.storeSlug?.trim();
      if (!slug) continue;
      const key = slug.toLowerCase();
      const list = bySlug.get(key) ?? [];
      list.push(row);
      bySlug.set(key, list);
    }

    const winners = [...bySlug.values()]
      .map((group) =>
        pickStoreSlugWinner(
          group.map((r) => ({
            id: r.id,
            storeSlug: r.storeSlug!.trim(),
            updatedAt: r.updatedAt,
            edition: r.edition,
            row: r,
          })),
        ),
      )
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
      .map((w) => w.row)
      .sort((a, b) => {
        if (a.storeSortOrder !== b.storeSortOrder) {
          return a.storeSortOrder - b.storeSortOrder;
        }
        return a.name.localeCompare(b.name, "es");
      });

    const assetIds = [
      ...new Set(
        winners
          .map((r) => r.primaryImageAssetId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const imageUrlByAssetId = new Map<string, string>();
    if (assetIds.length > 0) {
      const assets = await prisma.dnxMediaAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, publicUrl: true },
      });
      for (const asset of assets) {
        const url = asset.publicUrl?.trim();
        if (url) imageUrlByAssetId.set(asset.id, url);
      }
    }

    const products: StoreProductCardDto[] = [];
    for (const row of winners) {
      if (!row.storeSlug || row.storePrice == null) continue;
      products.push(
        mapStoreProductCard({
          id: row.id,
          editionId: row.editionId,
          name: row.name,
          description: row.description,
          storeSlug: row.storeSlug,
          storeTitle: row.storeTitle,
          storeDescription: row.storeDescription,
          storePrice: row.storePrice,
          storeCurrency: row.storeCurrency,
          primaryImageUrl: row.primaryImageAssetId
            ? (imageUrlByAssetId.get(row.primaryImageAssetId) ?? null)
            : null,
          priceLabel: formatPublicPrice(row.storePrice, row.storeCurrency || "ARS"),
        }),
      );
    }
    return products;
  } catch {
    return [];
  }
}
