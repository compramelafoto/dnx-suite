import type { Prisma } from "@/lib/prisma";
import type { AlbumPackPrintProductDetails } from "@/lib/album-packs/album-pack-composition-types";
import { AlbumPackOrderCreationPrepError } from "@/lib/album-packs/prepare-album-pack-order-creation";

type TxClient = Prisma.TransactionClient;

export async function loadAlbumPackPrintProductsById(
  tx: TxClient,
  productIds: number[],
  photographerUserId: number
): Promise<Map<number, AlbumPackPrintProductDetails>> {
  const uniqueIds = Array.from(
    new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  const result = new Map<number, AlbumPackPrintProductDetails>();
  if (uniqueIds.length === 0) return result;

  const rows = await tx.photographerProduct.findMany({
    where: {
      id: { in: uniqueIds },
      userId: photographerUserId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      size: true,
      acabado: true,
    },
  });

  for (const row of rows) {
    const size = String(row.size ?? "").trim();
    if (!size) {
      throw new AlbumPackOrderCreationPrepError(
        `El producto de impresión ${row.id} no tiene tamaño configurado.`,
        "PRINT_PRODUCT_MISSING_SIZE"
      );
    }
    const finishRaw = String(row.acabado ?? "BRILLO").trim();
    result.set(row.id, {
      photographerProductId: row.id,
      productName: row.name,
      size,
      finish: (finishRaw || "BRILLO").toUpperCase(),
    });
  }

  for (const id of uniqueIds) {
    if (!result.has(id)) {
      throw new AlbumPackOrderCreationPrepError(
        `Producto de impresión ${id} no disponible para el fotógrafo del álbum.`,
        "PRINT_PRODUCT_NOT_FOUND"
      );
    }
  }

  return result;
}
