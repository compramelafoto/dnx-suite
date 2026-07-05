import { prisma } from "@/lib/prisma";
import type { AlbumBlocker, AlbumBlockerReport } from "@/lib/album-cleanup/types";

export async function hasActivePrintOrdersForFileKeys(
  fileKeys: string[]
): Promise<boolean> {
  if (fileKeys.length === 0) return false;
  const active = await prisma.printOrderItem.findFirst({
    where: {
      fileKey: { in: fileKeys },
      order: { status: { notIn: ["CANCELED"] } },
    },
    select: { id: true },
  });
  return active != null;
}

export async function getPhotoOrderItemBlockers(
  photoIds: number[]
): Promise<Set<number>> {
  if (photoIds.length === 0) return new Set();
  const rows = await prisma.orderItem.findMany({
    where: { photoId: { in: photoIds } },
    select: { photoId: true },
    distinct: ["photoId"],
  });
  return new Set(rows.map((r) => r.photoId));
}

export async function detectAlbumDeleteBlockers(
  albumId: number
): Promise<AlbumBlockerReport> {
  const blockers: AlbumBlocker[] = [];

  const [
    orders,
    albumInvitations,
    albumAccesses,
    albumInterests,
    removalRequests,
    organizerDownloads,
    packDefinitions,
    preCompraOrders,
    remainingPhotoRows,
  ] = await Promise.all([
    prisma.order.count({ where: { albumId } }),
    prisma.albumInvitation.count({ where: { albumId } }),
    prisma.albumAccess.count({ where: { albumId } }),
    prisma.albumInterest.count({ where: { albumId } }),
    prisma.removalRequest.count({ where: { albumId } }),
    prisma.organizerEventDownload.count({ where: { albumId } }),
    prisma.packDefinition.count({ where: { albumId } }),
    prisma.preCompraOrder.count({ where: { albumId } }),
    prisma.photo.count({ where: { albumId } }),
  ]);

  const push = (kind: AlbumBlocker["kind"], count: number) => {
    if (count > 0) blockers.push({ kind, count });
  };

  push("ORDER", orders);
  push("ALBUM_INVITATION", albumInvitations);
  push("ALBUM_ACCESS", albumAccesses);
  push("ALBUM_INTEREST", albumInterests);
  push("REMOVAL_REQUEST", removalRequests);
  push("ORGANIZER_DOWNLOAD", organizerDownloads);
  push("PACK_DEFINITION", packDefinitions);
  push("PRECOMPRA_ORDER", preCompraOrders);

  const photoIds = (
    await prisma.photo.findMany({
      where: { albumId },
      select: { id: true },
    })
  ).map((p) => p.id);

  let orderItemCount = 0;
  if (photoIds.length > 0) {
    orderItemCount = await prisma.orderItem.count({
      where: { photoId: { in: photoIds } },
    });
    push("ORDER_ITEM", orderItemCount);
  }

  const hasPhotoRowBlockers = orderItemCount > 0 || remainingPhotoRows > 0;
  const hasAlbumTableBlockers = blockers.some((b) => b.kind !== "ORDER_ITEM");

  const primaryReason =
    blockers.length > 0
      ? blockers
          .sort((a, b) => b.count - a.count)
          .map((b) => `${b.kind}:${b.count}`)
          .join(", ")
      : null;

  const hasAlbumDeleteBlockers = hasAlbumTableBlockers || hasPhotoRowBlockers;

  return {
    blockers,
    hasPhotoRowBlockers,
    hasAlbumTableBlockers,
    hasAlbumDeleteBlockers,
    primaryReason,
    remainingPhotoRows,
  };
}
