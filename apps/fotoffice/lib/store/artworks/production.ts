/**
 * Producción de obras (spec O12, §5.8): qué ve quien imprime en cada renglón de obra y la
 * descarga del original.
 *
 * FotoRank no revisa permisos al servir el original: **firmar es autorizar**. Por eso este
 * módulo es la única barrera y se firma sólo si el pedido es del workspace, entró la plata y
 * sigue vivo (PAID/READY/SHIPPED/DELIVERED), el renglón es de ese pedido y es de obra, y la
 * ficha es del mismo workspace. Los logs llevan sólo ids.
 */
import "server-only";

import { prisma, type StoreOrderStatus } from "@repo/db";

import { printFormatSize } from "./format-label";
import { ArtworkImageError, buildOriginalUrl } from "./fotorank-client";
import { needsBorders } from "./resolution";

const ESTADOS_CON_ORIGINAL: readonly StoreOrderStatus[] = ["PAID", "READY", "SHIPPED", "DELIVERED"];

/** Pagado y no cancelado: se puede imprimir. Sin stock (PAID_NO_STOCK) no hubo venta. */
export function canDownloadOriginal(status: StoreOrderStatus): boolean {
  return ESTADOS_CON_ORIGINAL.includes(status);
}

export type ArtworkProductionInfo = {
  formatLabel: string;
  /** "30 × 45 cm"; `null` si el formato ya no existe. */
  sizeLabel: string | null;
  /** "4000 × 6000 px"; `null` si la ficha ya no existe. */
  pixelsLabel: string | null;
  /** La proporción de la foto no coincide con la del formato: se imprime con bordes. */
  borders: boolean;
};

/** `null` para un renglón de producto. Módulo puro en lo que hace (sin base). */
export function artworkProductionInfo(item: {
  printFormatName: string | null;
  printFormat: { name: string; widthCm: number; heightCm: number } | null;
  artworkListing: { originalWidth: number; originalHeight: number } | null;
}): ArtworkProductionInfo | null {
  if (!item.printFormatName && !item.printFormat && !item.artworkListing) return null;
  const original = item.artworkListing
    ? { width: item.artworkListing.originalWidth, height: item.artworkListing.originalHeight }
    : null;
  return {
    formatLabel: item.printFormatName ?? item.printFormat?.name ?? "Formato",
    sizeLabel: item.printFormat ? printFormatSize(item.printFormat) : null,
    pixelsLabel: original ? `${original.width} × ${original.height} px` : null,
    borders: Boolean(original && item.printFormat && needsBorders(original, item.printFormat)),
  };
}

export type OriginalDownloadResult = { ok: true; url: string } | { ok: false; error: string };

const NO_DISPONIBLE = "El original no está disponible para este renglón.";

export async function resolveOriginalDownload(input: {
  workspaceId: string;
  orderId: string;
  itemId: string;
}): Promise<OriginalDownloadResult> {
  const order = await prisma.storeOrder.findFirst({
    where: { id: input.orderId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, error: "No encontramos ese pedido." };
  if (!canDownloadOriginal(order.status)) {
    return { ok: false, error: "El original se descarga sólo de pedidos pagados que no se cancelaron." };
  }

  const item = await prisma.storeOrderItem.findFirst({
    where: { id: input.itemId, orderId: order.id },
    select: { artworkListingId: true, artworkListing: { select: { entryId: true, workspaceId: true } } },
  });
  if (!item?.artworkListingId || !item.artworkListing || item.artworkListing.workspaceId !== input.workspaceId) {
    return { ok: false, error: NO_DISPONIBLE };
  }

  try {
    return { ok: true, url: buildOriginalUrl(item.artworkListing.entryId) };
  } catch (e) {
    if (e instanceof ArtworkImageError && e.code === "ARTWORKS_NOT_CONFIGURED") {
      return { ok: false, error: "Las obras de FotoRank no están configuradas en este servidor." };
    }
    console.error("[store.artworks] no se pudo firmar el original", {
      orderId: order.id,
      itemId: input.itemId,
      code: e instanceof ArtworkImageError ? e.code : "UNKNOWN",
    });
    return { ok: false, error: NO_DISPONIBLE };
  }
}
